# app/services/rag.py
from __future__ import annotations
import os
from typing import Optional, List, Tuple, Set, Union, Dict, Any
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
from langchain_core.runnables import RunnableLambda
from langchain_community.vectorstores import FAISS

# --- construir FAISS vazio com segurança ---
import faiss  # type: ignore
from langchain_community.docstore.in_memory import InMemoryDocstore

from .embedder import get_embeddings
from .llm import get_llm
from ..config import settings
from .connectors import collect_documents

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


def _filter_nonempty(docs: List[Document]) -> List[Document]:
    """Remove documentos/chunks sem conteúdo útil."""
    out: List[Document] = []
    for d in docs:
        if not d:
            continue
        txt = (d.page_content or "").strip()
        if len(txt) >= 5:  # ignora textos muito curtos/vazios
            out.append(d)
    return out


def _debug_sample_docs(docs: List[Document], n: int = 5):
    print("\n[RAG][DEBUG] === SAMPLE DOCS ===")
    for i, d in enumerate(docs[:n]):
        print(f"--- DOC {i+1} ---")
        print("SOURCE:", d.metadata.get("source"))
        print("TITLE:", d.metadata.get("title"))
        txt = (d.page_content or "")[:400].replace("\n", " ")
        print("TEXT:", txt, "\n")


def _debug_sample_chunks(chunks: List[Document], n: int = 5):
    print("\n[RAG][DEBUG] === SAMPLE CHUNKS ===")
    for i, d in enumerate(chunks[:n]):
        print(f"--- CHUNK {i+1} ---")
        print("SOURCE:", d.metadata.get("source"))
        txt = (d.page_content or "")[:400].replace("\n", " ")
        print("TEXT:", txt, "\n")


def _build_empty_faiss(emb):
    """Cria um FAISS vazio (sem vetores) mas com a mesma dimensão do embedding."""
    try:
        dim = len(emb.embed_query("dimension_probe"))
    except Exception:
        dim = 384  # fallback para MiniLM; ajuste se quiser
    index = faiss.IndexFlatL2(dim)
    return FAISS(
        embedding_function=emb,
        index=index,
        docstore=InMemoryDocstore({}),
        index_to_docstore_id={},
    )


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
            print(f"[RAG] collect_documents() retornou {len(docs_extras)} docs.")
            if docs_extras:
                docs.extend(docs_extras)
        except Exception as e:
            print(f"[RAG] Falha ao coletar de conectores: {e}")

    # extra_docs explícitos (opcional)
    if extra_docs:
        docs.extend(extra_docs)

    # Filtra vazios
    docs = _filter_nonempty(docs)
    print(f"[RAG] Documentos após filtro: {len(docs)}")
    _debug_sample_docs(docs, n=8)

    # Seta conjunto de fontes para meta
    sources: Set[str] = set()
    for d in docs:
        meta = getattr(d, "metadata", {}) or {}
        src = meta.get("source", "unknown")
        sources.add(str(src))

    if not docs:
        print(f"[RAG] Nenhum documento com conteúdo encontrado. Construindo índice vazio.")
        _vectorstore = _build_empty_faiss(embeddings)
        _vectorstore.save_local(persist_dir)
        _meta = {"vectors": 0, "sources": sorted(sources) if sources else []}
        return _vectorstore, _meta

    chunks = _split_documents(docs)
    chunks = _filter_nonempty(chunks)
    print(f"[RAG] Chunks após split/filtro: {len(chunks)}")
    _debug_sample_chunks(chunks, n=8)

    if not chunks:
        print("[RAG] Nenhum chunk restante para indexar. Construindo índice vazio.")
        _vectorstore = _build_empty_faiss(embeddings)
        _vectorstore.save_local(persist_dir)
        _meta = {"vectors": 0, "sources": sorted(sources)}
        return _vectorstore, _meta

    _vectorstore = FAISS.from_documents(chunks, embeddings)
    _vectorstore.save_local(persist_dir)

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


# ===================== RETRIEVER (MMR + k dinâmico) ===================== #
def make_retriever(
    vs: Optional[Union[FAISS, Tuple[FAISS, dict]]] = None,
    k: int = 6,
    fetch_k: Optional[int] = None,
    lambda_mult: float = 0.5,
):
    """
    Retriever com MMR (diversificação). k = número de passagens devolvidas ao LLM.
    fetch_k = número de candidatos buscados antes da diversificação (default: max(k*4, 20)).
    lambda_mult = balanço entre relevância e diversidade (0..1).
    """
    vs_only = _ensure_vs(vs)
    if fetch_k is None:
        fetch_k = max(k * 4, 20)
    return vs_only.as_retriever(
        search_type="mmr",
        search_kwargs={"k": k, "fetch_k": fetch_k, "lambda_mult": lambda_mult},
    )


def make_qa_chain(vs: Optional[Union[FAISS, Tuple[FAISS, dict]]] = None):
    """
    Suporta top_k dinâmico: se o input for {"question": "...", "top_k": 8},
    o retriever será criado com k=8 (MMR).
    """

    def _normalize(x: Union[str, Dict[str, Any]]) -> Dict[str, Any]:
        if isinstance(x, str):
            return {"question": x, "top_k": None}
        # aceita "question" | "q" | "text"
        q = x.get("question") or x.get("q") or x.get("text")
        return {"question": q, "top_k": x.get("top_k")}

    def _retrieve_with_k(d: Dict[str, Any]) -> List[Document]:
        k = d.get("top_k") or 6
        retr = make_retriever(vs, k=k)
        return retr.invoke(d["question"])

    prompt = PromptTemplate(
        input_variables=["context", "question"],
        template=(
            "Você é o BIA, agente interno da Bemobi. Use o contexto para responder objetivamente. "
            "Se não houver info suficiente, diga que não encontrou.\n\n"
            "Contexto:\n{context}\n\nPergunta: {question}\n\nResposta:"
        ),
    )

    llm = get_llm()

    chain = (
        RunnableLambda(_normalize)
        | {
            "context": RunnableLambda(_retrieve_with_k) | _format_docs,
            "question": itemgetter("question"),
        }
        | prompt
        | llm
        | StrOutputParser()
    )
    return chain
