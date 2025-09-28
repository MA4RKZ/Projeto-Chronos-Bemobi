# app/services/rag.py
from __future__ import annotations
import os
from typing import Optional, List, Tuple, Set, Union

from operator import itemgetter

from langchain_community.document_loaders import (
    DirectoryLoader,
    TextLoader,
    PyPDFLoader,
    CSVLoader,
)
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langchain_community.vectorstores import FAISS

from .embedder import get_embeddings
from .llm import get_llm
from ..config import settings                # <- corrigido (services/config.py)
from .connectors import collect_documents   # <- integra conectores (urls/notion/gdrive/m365)

# cache em memória
_vectorstore: Optional[FAISS] = None
_meta: dict = {}


def _format_docs(docs: List[Document]) -> str:
    """Concatena documentos em texto, útil para prompt."""
    return "\n\n".join(
        f"Source: {d.metadata.get('source', '')}\n{d.page_content}" for d in docs
    )


def _faiss_count(vs: FAISS) -> Optional[int]:
    try:
        return vs.index.ntotal
    except Exception:
        return None


def _load_documents(docs_dir: str) -> List[Document]:
    """Carrega documentos locais do diretório de base."""
    loaders = [
        DirectoryLoader(
            docs_dir,
            glob="**/*.md",
            loader_cls=TextLoader,
            loader_kwargs={"encoding": "utf-8", "autodetect_encoding": True},
            show_progress=True,
        ),
        DirectoryLoader(
            docs_dir,
            glob="**/*.txt",
            loader_cls=TextLoader,
            loader_kwargs={"encoding": "utf-8", "autodetect_encoding": True},
            show_progress=True,
        ),
        DirectoryLoader(
            docs_dir,
            glob="**/*.pdf",
            loader_cls=PyPDFLoader,
            show_progress=True,
        ),
        DirectoryLoader(
            docs_dir,
            glob="**/*.csv",
            loader_cls=CSVLoader,
            loader_kwargs={"encoding": "utf-8"},
            show_progress=True,
        ),
    ]
    docs: List[Document] = []
    for loader in loaders:
        try:
            docs.extend(loader.load())
        except Exception as e:
            print(f"[RAG] Loader error {loader}: {e}")

    # Normaliza metadados mínimos
    for d in docs:
        src = d.metadata.get("source") or d.metadata.get("file_path") or "local"
        d.metadata["source"] = str(src).replace("\\", "/")
        d.metadata.setdefault("connector", "local")
        if "page" not in d.metadata and "page_number" in d.metadata:
            d.metadata["page"] = d.metadata["page_number"]

    return docs


def _split_documents(docs: List[Document]) -> List[Document]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    return splitter.split_documents(docs)


def build_or_load_vectorstore(
    rebuild: bool = False,
    extra_docs: Optional[List[Document]] = None,
) -> Tuple[FAISS, dict]:
    """
    Cria ou carrega o FAISS a partir de settings.DOCS_DIR e, quando rebuild=True,
    também agrega documentos vindos de conectores (URLs/Notion/GDrive/M365) via collect_documents().
    Persiste em settings.PERSIST_DIR.
    Retorna (vectorstore, meta) onde meta contém {vectors, sources}.
    """
    global _vectorstore, _meta

    # cache em memória
    if _vectorstore is not None and not rebuild:
        return _vectorstore, _meta

    embeddings = get_embeddings()
    persist_dir = settings.persist_dir
    index_path = os.path.join(persist_dir, "index.faiss")

    # caminho feliz: já existe índice no disco e não é rebuild
    if (not rebuild) and os.path.isdir(persist_dir) and os.path.exists(index_path):
        _vectorstore = FAISS.load_local(
            persist_dir, embeddings, allow_dangerous_deserialization=True
        )
        _meta = {"vectors": _faiss_count(_vectorstore), "sources": None}
        return _vectorstore, _meta

    # (re)construção
    os.makedirs(persist_dir, exist_ok=True)
    docs_dir = settings.docs_dir

    # 1) carrega docs locais
    docs_local: List[Document] = _load_documents(docs_dir)

    # 2) agrega conectores APENAS quando rebuild=True (ou se extra_docs informado)
    docs: List[Document] = list(docs_local)
    if rebuild:
        try:
            docs_extras = collect_documents()  # URLs/Notion/GDrive/M365 conforme connectors.json
            if docs_extras:
                docs.extend(docs_extras)
        except Exception as e:
            print(f"[RAG] Falha ao coletar de conectores: {e}")

    # extra_docs explícitos (opcional)
    if extra_docs:
        docs.extend(extra_docs)

    if not docs:
        print(f"[RAG] Nenhum documento encontrado em {docs_dir} (e conectores).")

    chunks = _split_documents(docs)
    _vectorstore = FAISS.from_documents(chunks, embeddings)
    _vectorstore.save_local(persist_dir)

    # meta: fontes únicas
    sources: Set[str] = set()
    for d in docs:
        meta = getattr(d, "metadata", {}) or {}
        src = meta.get("source", "unknown")
        sources.add(str(src))

    _meta = {"vectors": _faiss_count(_vectorstore), "sources": sorted(sources)}

    # telemetria (se existir)
    try:
        from .state import set_vectors, mark_ingest_now
        set_vectors(_meta["vectors"] or 0)
        mark_ingest_now()
    except Exception:
        pass

    return _vectorstore, _meta


def _ensure_vs(vs_or_tuple: Optional[Union[FAISS, Tuple[FAISS, dict]]]) -> FAISS:
    """Aceita FAISS ou (FAISS, meta) e devolve apenas o FAISS."""
    if vs_or_tuple is None:
        vs_or_tuple = build_or_load_vectorstore(rebuild=False)
    if isinstance(vs_or_tuple, tuple):
        return vs_or_tuple[0]
    return vs_or_tuple


def make_retriever(vs: Optional[Union[FAISS, Tuple[FAISS, dict]]] = None):
    vs_only = _ensure_vs(vs)
    return vs_only.as_retriever(search_kwargs={"k": 4})


def make_qa_chain(vs: Optional[Union[FAISS, Tuple[FAISS, dict]]] = None):
    retriever = make_retriever(vs)

    prompt = PromptTemplate(
        input_variables=["context", "question"],
        template=(
            "Você é o BIA, agente interno da Bemobi. Use o contexto para responder objetivamente. "
            "Se não houver info suficiente, diga que não encontrou.\n\n"
            "Contexto:\n{context}\n\nPergunta: {question}\n\nResposta:"
        ),
    )

    llm = get_llm()

    # normaliza: se entrar string -> vira {"question": string}; se já for dict, mantém
    normalize = RunnableLambda(lambda x: {"question": x} if isinstance(x, str) else x)

    chain = (
        normalize
        | {
            "context": itemgetter("question") | retriever | _format_docs,
            "question": itemgetter("question"),
        }
        | prompt
        | llm
        | StrOutputParser()
    )
    return chain
