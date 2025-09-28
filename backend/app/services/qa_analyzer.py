# app/services/qa_analyzer.py
import os, json, uuid, datetime, re
from pathlib import Path

# OCR / PDF opcionais
try:
    import pytesseract
    from PIL import Image
except Exception:
    pytesseract = None
    Image = None

try:
    import pdfplumber
except Exception:
    pdfplumber = None

from .rag import make_retriever, build_or_load_vectorstore
from .llm import get_llm
from .prompts_loader import load_prompt
from ..config import settings

# (Opcional futuro) carregar matriz de políticas por área (yaml)
# def load_policies(area: str | None) -> str:
#     if not area:
#         return "- msg de erro\n- retry_policy\n- idempotencia"
#     p = Path("app/data/qa/policies") / f"{area}.yaml"
#     if p.exists():
#         import yaml
#         data = yaml.safe_load(p.read_text(encoding="utf-8"))
#         items = data.get("criteria", [])
#         return "\n".join(f"- {c}" for c in items) or "- msg de erro\n- retry_policy\n- idempotencia"
#     return "- msg de erro\n- retry_policy\n- idempotencia"


def _extract_text_from_path(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    try:
        # TXT/LOG/MD sempre ok
        if ext in [".txt", ".log", ".md"]:
            return open(path, "r", encoding="utf-8", errors="ignore").read()

        # PDF (se pdfplumber disponível)
        if ext == ".pdf" and pdfplumber is not None:
            parts = []
            with pdfplumber.open(path) as pdf:
                for p in pdf.pages:
                    parts.append(p.extract_text() or "")
            return "\n".join(parts)

        # Imagens (se pytesseract disponível)
        if ext in [".png", ".jpg", ".jpeg"] and pytesseract is not None and Image is not None:
            return pytesseract.image_to_string(Image.open(path))

        # Se não suportado ou sem libs, retorna rótulo
        return f"[no_ocr_supported_for]{path}"
    except Exception as e:
        return f"[extract_error] {path}: {e}"


def _parse_llm_json(raw: str) -> dict | None:
    # tenta pegar bloco ```json ... ```
    m = re.search(r"```json\s*(\{.*?\})\s*```", raw, re.S)
    if not m:
        # fallback: primeiro { ... } do texto
        m = re.search(r"(\{.*\})", raw, re.S)
    try:
        return json.loads(m.group(1)) if m else None
    except Exception:
        return None


def analyze_evidence(case_title: str, evidence_paths: list, area: str | None = None):
    # 1) extrai texto das evidências
    evidence_texts = [_extract_text_from_path(p) for p in evidence_paths]
    evidence_text = "\n\n".join(evidence_texts)

    # 2) contexto via RAG
    vs, _ = build_or_load_vectorstore(rebuild=False)
    retriever = make_retriever(vs, k=6)
    seed = (case_title or "") + " " + evidence_text[:1200]
    context_docs = retriever.get_relevant_documents(seed)
    context = "\n\n".join([d.page_content for d in context_docs])

    # 3) critérios requeridos
    # required_criteria = load_policies(area)  # quando ativar YAML por área
    required_criteria = "- msg de erro\n- retry_policy\n- idempotencia"

    # 4) LLM
    prompt = load_prompt("qa_evaluate.txt").format(
        context=context,
        case_title=case_title,
        evidence_text=evidence_text,
        required_criteria=required_criteria,
    )
    llm = get_llm()
    raw = llm.invoke(prompt).content if hasattr(llm, "invoke") else str(llm(prompt))

    # 4.1) tentar extrair JSON estruturado do raw
    structured = _parse_llm_json(raw)
    evaluation = structured.get("evaluation") if structured else None
    suggestions = structured.get("suggestions") if structured else None

    # 5) montar salva/retorno
    now = datetime.datetime.now()
    rid = f"qa_{now.strftime('%Y_%m_%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

    reports_dir = Path(settings.reports_dir)
    reports_dir.mkdir(parents=True, exist_ok=True)

    # normaliza evidências para "/"
    normalized_evidences = [str(Path(p)).replace("\\", "/") for p in evidence_paths]

    report = {
        "id": rid,
        "title": f"Análise - {case_title}",
        "area": area,
        "inputs": {"case_title": case_title, "evidences": normalized_evidences},
        "extracted": {"text": evidence_text},
        "llm_raw": raw,
        "evaluation": evaluation,      # <- já entra no JSON
        "suggestions": suggestions,    # <- idem
        "created_at": now.isoformat(),
        "report_markdown_path": None,
    }

    # salva JSON (primeira versão)
    json_path = reports_dir / f"{rid}.json"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    # gera Markdown (resumo)
    md_lines = [
        f"# {report['title']}",
        f"*Área:* {area or '-'}",
        "",
        "## Evidências",
        *[f"- {p}" for p in normalized_evidences],
        "",
        "## Trecho extraído",
        "```",
        (evidence_text[:2000] + ("..." if len(evidence_text) > 2000 else "")),
        "```",
        "",
        "## Saída do LLM (raw)",
        "```",
        raw[:3000] + ("..." if len(raw) > 3000 else ""),
        "```",
    ]
    md_path = reports_dir / f"{rid}.md"
    md_path.write_text("\n".join(md_lines), encoding="utf-8")

    # atualiza JSON com caminho do MD
    report["report_markdown_path"] = str(md_path).replace("\\", "/")
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    return report


def publish_report(report_id: str, target: str = "notion"):
    """
    Placeholder: abrir <reports_dir>/<id>.json e publicar em Notion/Drive se quiser.
    """
    return {"status": "ok", "published_to": target, "id": report_id}
