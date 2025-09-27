# BIA — Bemobi Internal Agent (MVP)

Agent RAG interno para acelerar respostas sobre documentos/processos da Bemobi.
Stack: **FastAPI + LangChain/FAISS** (backend) e **Next.js/Tailwind** (frontend).

## 1) Pré‑requisitos
- Python 3.10+
- Node 18+ / PNPM ou NPM
- (opcional) Docker + Docker Compose
- Chave de API da OpenAI (`OPENAI_API_KEY`) para LLM/embeddings

## 2) Setup rápido

### Backend
```bash
cd backend
python -m venv .venv
# Windows PowerShell:
. .venv/Scripts/Activate.ps1
# Linux/Mac:
# source .venv/bin/activate

pip install -r requirements.txt

# Copie variáveis
cp .env.example .env
# edite .env e defina OPENAI_API_KEY, etc.

# suba a API
uvicorn app.main:app --reload --port 8000
```

### Ingestão (construir o índice)
- Coloque arquivos em `backend/app/data/docs` (PDF, TXT, MD).
- Chame o endpoint de ingestão (rebuild total):
```bash
curl -X POST http://localhost:8000/api/ingest -H "Content-Type: application/json" -d '{"rebuild": true}'
```

### Frontend
```bash
cd frontend
cp .env.local.example .env.local  # ajuste BACKEND_URL se necessário
npm install
npm run dev
```
Abra http://localhost:3000

## 3) Docker (opcional)
```bash
docker compose up --build
```

## 4) Estrutura
- **backend/** FastAPI + LangChain (RAG, FAISS)
- **frontend/** Next.js (App Router) + Tailwind (UI de chat)
- **docker-compose.yml** para subir tudo junto

## 5) Variáveis de ambiente
Veja `.env.example` (backend) e `.env.local.example` (frontend).

## 6) Endpoints principais
- `GET /health` — status
- `POST /api/ingest` — ingere e/ou reconstrói o índice FAISS
- `POST /api/chat` — {message} => resposta do agente + fontes

## 7) Observações
- Este é um esqueleto. Em produção:
  - adicione autenticação (JWT/OAuth), logs e métricas,
  - configure storage persistente do FAISS,
  - limite de tokens/custos do LLM,
  - sanitize e versionamento de documentos.
