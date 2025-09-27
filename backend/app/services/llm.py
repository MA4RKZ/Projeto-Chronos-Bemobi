from langchain_openai import ChatOpenAI
from ..config import settings

def get_llm() -> ChatOpenAI:
    base_url = settings.openai_base_url
    if settings.use_lm_studio and not base_url:
        base_url = "http://127.0.0.1:1234/v1"

    kwargs = {
        "model": settings.model_name,
        "temperature": 0.2,
        "api_key": settings.openai_api_key or "lm-studio",
        "max_tokens": 512,   # evita respostas muito longas
    }
    if base_url:
        kwargs["base_url"] = base_url
    return ChatOpenAI(**kwargs)