# app/routers/qa.py
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from typing import List, Optional
from pathlib import Path
import os
import re
import uuid
import json

from ..services.qa_analyzer import analyze_evidence, publish_report
from ..config import settings

router = APIRouter(prefix="/api/qa", tags=["qa"])

# Usa diretórios do settings se existirem; caso contrário, fallback.
REPORTS_DIR = Path(getattr(settings, "reports_dir", "app/data/reports"))
UPLOADS_DIR = Path(getattr(settings, "upload_dir", "app/data/uploads"))

# Garante que os diretórios existem
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def _safe_name(name: str) -> str:
    """Saneia o nome do arquivo para evitar caracteres problemáticos."""
    name = (name or "").strip().replace(" ", "_")
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    return name or f"upload_{uuid.uuid4().hex}.txt"


@router.post("/analyze")
async def analyze(
    case_title: str = Form(...),
    area: Optional[str] = Form(None),                  # ex.: 'pix'
    files: List[UploadFile] = File(default=[])         # field name: 'files'
):
    # 1) Criar diretórios (idempotente)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    # 2) Salvar evidências
    saved_paths: List[str] = []
    try:
        for f in files:
            safe_filename = _safe_name(f.filename or "")
            dest_path = UPLOADS_DIR / safe_filename
            content = await f.read()
            with open(dest_path, "wb") as out:
                out.write(content)
            # normaliza para "/" (evita "\" no Windows)
            saved_paths.append(str(dest_path).replace("\\", "/"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha ao salvar evidências: {e}")

    if not saved_paths:
        # Permitir uso sem arquivos? Se não, lança erro:
        raise HTTPException(status_code=400, detail="Nenhum arquivo foi enviado.")

    # 3) Rodar o analisador
    try:
        report = analyze_evidence(
            case_title=case_title,
            evidence_paths=saved_paths,
            area=area,
        )
        # Espera-se que o serviço preencha ao menos:
        # { id, title, area, report_markdown_path, created_at, ... }
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha ao analisar: {e}")


@router.get("/reports")
def list_reports():
    """
    Varre '<reports_dir>/*.json' e retorna uma lista de metadados.
    """
    if not REPORTS_DIR.exists():
        return []

    items = []
    for fp in REPORTS_DIR.glob("*.json"):
        try:
            data = json.loads(fp.read_text(encoding="utf-8"))
            items.append({
                "id": data.get("id") or fp.stem,
                "title": data.get("title"),
                "area": data.get("area"),
                "created_at": data.get("created_at"),
                "report_json_path": str(fp).replace("\\", "/"),
                "report_markdown_path": data.get("report_markdown_path"),
            })
        except Exception:
            # ignora arquivos inválidos
            pass

    # ordena por data desc (se não houver, mantém no fim)
    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return items


@router.get("/reports/{report_id}")
def get_report(report_id: str):
    """
    Retorna o JSON do relatório por ID (procura <id>.json no reports_dir).
    """
    jpath = REPORTS_DIR / f"{report_id}.json"
    if not jpath.exists():
        raise HTTPException(status_code=404, detail="Relatório não encontrado")

    try:
        data = json.loads(jpath.read_text(encoding="utf-8"))
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha ao ler relatório: {e}")


@router.get("/report_md/{report_id}")
def get_report_md(report_id: str):
    """
    Retorna o arquivo Markdown do relatório.
    Prioriza o caminho salvo no JSON; se não houver, tenta <reports_dir>/<id>.md.
    """
    jpath = REPORTS_DIR / f"{report_id}.json"
    if not jpath.exists():
        raise HTTPException(status_code=404, detail="Relatório não encontrado")

    try:
        data = json.loads(jpath.read_text(encoding="utf-8"))
        md_path = data.get("report_markdown_path")
        if md_path:
            md_file = Path(md_path)
            if not md_file.is_absolute():
                md_file = (REPORTS_DIR / md_file.name)
        else:
            md_file = REPORTS_DIR / f"{report_id}.md"

        if not md_file.exists():
            raise HTTPException(status_code=404, detail="Markdown do relatório não encontrado")

        return FileResponse(
            path=str(md_file),
            media_type="text/markdown",
            filename=md_file.name
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha ao servir Markdown: {e}")


@router.post("/publish")
def publish(report_id: str, target: str = "notion"):
    """
    (Opcional) Criar/atualizar página no Notion/Drive com o relatório e/ou caso corrigido.
    """
    try:
        return publish_report(report_id, target)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha ao publicar: {e}")
