# app/config.py
import os
from pydantic import BaseModel
from pathlib import Path
from dotenv import load_dotenv

# tenta backend/.env e app/.env
for p in [Path(__file__).resolve().parents[2] / ".env",
          Path(__file__).resolve().parents[1] / ".env"]:
    if p.exists():
        load_dotenv(p, override=False)

class Settings(BaseModel):
    # LLM / Embeddings
    use_lm_studio: bool = os.getenv("USE_LM_STUDIO", "false").lower() == "true"
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    model_name: str = os.getenv("OPENAI_MODEL", "qwen2.5-7b-instruct")

    embeddings_backend: str = os.getenv("EMBEDDINGS_BACKEND", "huggingface")
    embeddings_model: str = os.getenv(
        "EMBEDDINGS_MODEL",
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )

    # RAG
    persist_dir: str = os.getenv("PERSIST_DIR", "app/data/vectorstore")
    docs_dir: str = os.getenv("DOCS_DIR", "app/data/docs")

    # CORS
    cors_origins: list[str] = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000"
    ).split(",")

    # === QA (NOVO) ===
    upload_dir: str = os.getenv("UPLOAD_DIR", "app/data/uploads")
    reports_dir: str = os.getenv("REPORTS_DIR", "app/data/reports")

    upload_dir: str = os.getenv("UPLOAD_DIR", "app/data/uploads")
    reports_dir: str = os.getenv("REPORTS_DIR", "app/data/reports")

settings = Settings()
