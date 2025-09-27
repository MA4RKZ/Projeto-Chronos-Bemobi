from __future__ import annotations
import os
from typing import Optional, List, Tuple, Set
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
from langchain_core.runnables import RunnablePassthrough
from langchain_community.vectorstores import FAISS

from operator import itemgetter
from langchain_core.runnables import RunnableLambda

from .embedder import get_embeddings
from .llm import get_llm
from ..config import settings

# cache em memória
_vectorstore: Optional[FAISS] = None
_meta: dict = {}

def _format_docs(docs: List[Document]) -> str:
    return "\n\n".join(
        f"Source: {d.metadata.get('source', '')}\n{d.page_content}" for d in docs
    )

def _faiss_count(vs: FAISS) -> Optional[int]:
    try:
        return vs.index.ntotal
    except Exception:
        return None


def _load_documents(docs_dir: str) -> List[Document]:
    loaders = [
        DirectoryLoader(
            docs_dir, glob="**/*.md",
            loader_cls=TextLoader, loader_kwargs={"encoding": "utf-8"},
            show_progress=True
        ),
        DirectoryLoader(
            docs_dir, glob="**/*.txt",
            loader_cls=TextLoader, loader_kwargs={"encoding": "utf-8"},
            show_progress=True
        ),
        DirectoryLoader(
            docs_dir, glob="**/*.pdf",
            loader_cls=PyPDFLoader, show_progress=True
        ),
        DirectoryLoader(
            docs_dir, glob="**/*.csv",
            loader_cls=CSVLoader, loader_kwargs={"encoding": "utf-8"},
            show_progress=True
        ),
    ]
    docs: List[Document] = []
    for loader in loaders:
        try:
            docs.extend(loader.load())
        except Exception as e:
            print(f"[RAG] Loader error {loader}: {e}")
    return docs


def _split_documents(docs: List[Document]) -> List[Document]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    return splitter.split_documents(docs)


def build_or_load_vectorstore(
    rebuild: bool = False,
    extra_docs: Optional[List[Document]] = None
) -> Tuple[FAISS, dict]:
    """
    Cria ou carrega o FAISS a partir de settings.DOCS_DIR + (opcionalmente) documentos de conectores.
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

    # caminho feliz: já existe índice no disco
    if (not rebuild) and os.path.isdir(persist_dir) and os.path.exists(index_path):
        _vectorstore = FAISS.load_local(
            persist_dir, embeddings, allow_dangerous_deserialization=True
        )
        _meta = {"vectors": _faiss_count(_vectorstore), "sources": None}
        return _vectorstore, _meta

    # (re)construção
    os.makedirs(persist_dir, exist_ok=True)
    docs_dir = settings.docs_dir

    docs: List[Document] = _load_documents(docs_dir)
    if extra_docs:
        # mescla documentos coletados pelos conectores (urls, notion, etc.)
        docs.extend(extra_docs)

    if not docs:
        print(f"[RAG] Nenhum documento encontrado em {docs_dir} (e conectores).")

    chunks = _split_documents(docs)
    _vectorstore = FAISS.from_documents(chunks, embeddings)
    _vectorstore.save_local(persist_dir)

    sources: Set[str] = set()
    for d in docs:
        meta = getattr(d, "metadata", {}) or {}
        src = meta.get("source", "unknown")
        sources.add(str(src))

    _meta = {"vectors": _faiss_count(_vectorstore), "sources": sorted(sources)}

    # atualiza telemetria se disponível
    try:
        from .state import set_vectors, mark_ingest_now
        set_vectors(_meta["vectors"] or 0)
        mark_ingest_now()
    except Exception:
        pass

    return _vectorstore, _meta


def make_retriever(vs: Optional[FAISS] = None):
    if vs is None:
        vs = build_or_load_vectorstore(rebuild=False)
    return vs.as_retriever(search_kwargs={"k": 4})


def make_qa_chain(vs=None):
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
