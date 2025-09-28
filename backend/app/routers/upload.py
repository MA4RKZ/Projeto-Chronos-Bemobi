# app/routers/upload.py
from fastapi import APIRouter, UploadFile, File, Query, HTTPException
from typing import List, Dict, Any
from pathlib import Path
import os
import shutil
import time

from ..config import settings
from ..services.rag import build_or_load_vectorstore

router = APIRouter()

ALLOWED_EXTS = {".pdf", ".txt", ".md", ".csv", ".docx", ".doc", ".xlsx", ".xls"}

def _sanitize_filename(name: str) -> str:
    # remove path separators e caracteres problemáticos
    name = name.replace("\\", "/").split("/")[-1]
    return "".join(c for c in name if c.isalnum() or c in ("-", "_", ".", " ")).strip()

@router.post("/api/upload")
async def upload_files(
    files: List[UploadFile] = File(...),
    reindex: bool = Query(False, description="Se true, reconstrói o índice após salvar os arquivos")
):
    docs_dir = settings.docs_dir
    os.makedirs(docs_dir, exist_ok=True)

    saved: List[Dict[str, Any]] = []

    for f in files:
        if not f.filename:
            continue
        fname = _sanitize_filename(f.filename)
        ext = Path(fname).suffix.lower()
        if ext and ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"Extensão não suportada: {ext}")

        # se já existir, cria um nome único
        dst = Path(docs_dir) / fname
        if dst.exists():
            stem = dst.stem
            unique = f"{stem}_{int(time.time())}{dst.suffix}"
            dst = Path(docs_dir) / unique

        # salva conteúdo
        with dst.open("wb") as out:
            shutil.copyfileobj(f.file, out)

        saved.append({"file": f.filename, "path": str(dst)})

    if reindex:
        vs, meta = build_or_load_vectorstore(rebuild=True)
        return {"status": "ok", "saved": saved, "reindexed": True, "vectors": meta.get("vectors")}
    else:
        # não reindexou — retorna apenas confirmação
        return {"status": "ok", "saved": saved, "reindexed": False}
