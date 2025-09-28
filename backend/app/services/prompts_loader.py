from pathlib import Path

PROMPTS_DIR = Path("app/data/prompts")
PROMPTS_DIR.mkdir(parents=True, exist_ok=True)

def load_prompt(name: str) -> str:
    """
    Lê um arquivo de prompt de app/data/prompts/<name>.
    Ex.: load_prompt("qa_evaluate.txt")
    """
    path = PROMPTS_DIR / name
    if not path.exists():
        # fallback mínimo
        return (
            "Você é um analista de QA. Use o contexto e as evidências para avaliar o caso.\n\n"
            "Contexto:\n{context}\n\n"
            "Título do caso: {case_title}\n\n"
            "Evidências:\n{evidence_text}\n\n"
            "Critérios obrigatórios:\n{required_criteria}\n\n"
            "Gere um JSON com os campos: title, evaluation(criteria: name, result, reason), "
            "suggestions, additional_cases."
        )
    return path.read_text(encoding="utf-8")
