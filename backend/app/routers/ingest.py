from fastapi import APIRouter
from ..models import IngestRequest
from ..services.rag import build_or_load_vectorstore
from ..services.connectors import collect_documents

router = APIRouter()

def _faiss_count(vs):
    try:
        return vs.index.ntotal  # FAISS
    except Exception:
        return None

@router.post("/api/ingest")
def ingest(req: IngestRequest):
    # coleta docs de conectores habilitados (além da pasta local)
    extra_docs = collect_documents()
    vs, meta = build_or_load_vectorstore(rebuild=req.rebuild, extra_docs=extra_docs)
    total = _faiss_count(vs)
    return {
        "status": "ok",
        "rebuild": req.rebuild,
        "vectors": total,
        "sources": meta.get("sources"),
    }
