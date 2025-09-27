from fastapi import APIRouter, HTTPException
from ..models import ChatRequest, ChatResponse, SourceDoc
from ..services.rag import build_or_load_vectorstore, make_qa_chain, make_retriever
from ..services.state import inc

router = APIRouter()

@router.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    user_input = (req.message or req.question or "").strip()
    if not user_input:
        raise HTTPException(status_code=400, detail="message vazio")

    vs, _meta = build_or_load_vectorstore(rebuild=False)
    retriever = make_retriever(vs)
    if req.top_k:
        retriever.search_kwargs["k"] = req.top_k  # parametriza k

    # pega fontes (API nova .invoke); só busca se caller quiser fontes
    docs = retriever.invoke(user_input) if req.return_sources else []

    chain = make_qa_chain(vs)
    answer = chain.invoke(user_input)

    srcs = []
    for d in docs:
        meta = d.metadata or {}
        page = meta.get("page") or meta.get("page_number")
        srcs.append(
            SourceDoc(source=str(meta.get("source", "unknown")), page=page)
        )

    # telemetria básica
    try:
        inc("chats", 1)
        # se quiser contar buscas, descomente:
        # inc("searches", 1)
    except Exception:
        pass

    return ChatResponse(answer=answer, sources=srcs)
