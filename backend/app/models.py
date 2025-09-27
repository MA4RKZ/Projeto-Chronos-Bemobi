from pydantic import BaseModel
from typing import Optional, List

# === Ingest ===
class IngestRequest(BaseModel):
    rebuild: bool = False

# === Chat ===
class SourceDoc(BaseModel):
    source: str
    page: Optional[int] = None

class ChatRequest(BaseModel):
    message: Optional[str] = None
    question: Optional[str] = None
    top_k: Optional[int] = 4
    return_sources: Optional[bool] = True

class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceDoc] = []
