from fastapi import APIRouter, HTTPException
from ..services import connectors
from ..services.state import get_stats
from ..services.rag import build_or_load_vectorstore
from ..models import IngestRequest

router = APIRouter()

@router.get("/api/admin/stats")
def stats():
    return get_stats()

@router.get("/api/connectors")
def get_connectors():
    return connectors.list_connectors()

@router.put("/api/connectors/{name}")
def put_connector(name: str, patch: dict):
    try:
        updated = connectors.update_connector(name, patch)
        return {"ok": True, "connector": name, "config": updated}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/api/admin/sync")
def sync(req: IngestRequest):
    """
    Faz ingestão usando TANTO a pasta local quanto conectores habilitados.
    Se req.rebuild=True, recria o índice do zero.
    """
    extra_docs = connectors.collect_documents()
    vs, meta = build_or_load_vectorstore(rebuild=req.rebuild, extra_docs=extra_docs)
    return {"ok": True, "vectors": meta.get("vectors"), "sources": meta.get("sources")}
