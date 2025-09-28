# Chronos — Bemobi Internal Agent

Agente interno de IA (B2I) que centraliza conhecimento e acelera o trabalho dos times da **Bemobi**.  
Inclui **RAG** (chat sobre documentos), **Painel Admin** (fontes/ingestão) e **Cronos QA+** (upload de evidências e geração de relatórios de QA).

- **Backend:** FastAPI + LangChain + FAISS
- **Frontend:** Next.js (App Router) + TailwindCSS
- **Conectores:** Local (filesystem), URLs, Notion, Google Drive (esqueleto), M365 (placeholder)

---

## 1) Visão Geral

**Módulos principais**

1. **Chat (RAG):** Pergunte sobre documentos (PDF/TXT/MD/CSV) indexados.
2. **Admin:** Habilite conectores (Local/URLs/Notion/…); rode **Sync/Reindex**; visualize métricas.
3. **QA (Cronos QA+):** Faça upload de evidências (`.txt/.log/.md/.pdf/.png/.jpg`), o agente extrai texto, compara com políticas e gera **relatório (.json + .md)**.

---

## 2) Requisitos

- **Python 3.10+**
- **Node 18+** (ou PNPM)
- (opcional) **Docker** + **Docker Compose**
- **OPENAI_API_KEY** (ou **LM Studio**) para LLM/embeddings

---

## 3) Estrutura de Pastas
```
chronos/
├─ backend/
│ ├─ app/
│ │ ├─ main.py
│ │ ├─ routers/
│ │ │ ├─ chat.py
│ │ │ ├─ ingest.py
│ │ │ ├─ admin.py
│ │ │ └─ qa.py
│ │ ├─ services/
│ │ │ ├─ rag.py
│ │ │ ├─ llm.py
│ │ │ ├─ embedder.py
│ │ │ ├─ connectors.py
│ │ │ ├─ qa_analyzer.py
│ │ │ └─ prompts_loader.py
│ │ ├─ data/
│ │ │ ├─ docs/ # coloque seus arquivos aqui
│ │ │ ├─ reports/ # relatórios QA gerados (json/md)
│ │ │ ├─ uploads/ # evidências enviadas pelo QA
│ │ │ └─ connectors.json # config de conectores
│ │ └─ prompts/
│ │ └─ qa_evaluate.txt
│ └─ requirements.txt
└─ frontend/
├─ app/
│ ├─ page.tsx # Chat
│ ├─ admin/page.tsx # Painel Admin
│ ├─ qa/upload/page.tsx # Upload QA
│ └─ qa/reports/... # Lista/Detalhe de relatórios
├─ components/
├─ lib/api.ts
└─ styles/globals.css
```

## 4) Backend — Setup
```
cd backend
python -m venv .venv
# Windows PowerShell
. .venv/Scripts/Activate.ps1
# Linux/Mac
# source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

Edite o .env (exemplo):
```
# LLM (use OpenAI ou LM Studio)
OPENAI_API_KEY=sk-xxxx
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
USE_LM_STUDIO=false

# Embeddings
EMBEDDINGS_BACKEND=huggingface
EMBEDDINGS_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2

# Pastas
PERSIST_DIR=app/data/vectorstore
DOCS_DIR=app/data/docs

# CORS (frontend)
CORS_ORIGINS=http://localhost:3000
```

Rodar a API:
```
uvicorn app.main:app --reload --port 8000
```

## 5) Backend — Setup
```
cd frontend
cp .env.local.example .env.local
# Ajuste a URL do backend se necessário:
# NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

npm install
npm run dev
```

## 6) Ingestão de Documentos (Admin)
1. Coloque arquivos em backend/app/data/docs.
2. Vá em Admin → Reindexar (rebuild total) ou Sincronizar (coleta conforme conectores).
3. Também é possível via endpoint:
```
curl -X POST http://localhost:8000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"rebuild": true}'
```

connectors.json (exemplo mínimo):
```
{
  "local": { "enabled": true, "path": "app/data/docs" },
  "urls":  { "enabled": false, "list": ["https://www.example.com"] },
  "notion": { "enabled": false, "integration_token": "", "database_id": "" },
  "gdrive": { "enabled": false, "folder_id": "", "service_account_json": "" },
  "m365":  { "enabled": false, "site_id": "", "drive_id": "", "client_id": "", "tenant_id": "", "client_secret": "" }
}
```

## 7) Chat (RAG)
Pergunte sobre conteúdo vetorizado.

As respostas trazem fontes com source e page.

Retrievers com MMR (diversificação) e k configurável.

## 8) QA (Cronos QA+)
Fluxo:

Acesse QA → Upload.

Preencha:

Título do caso (ex.: PIX – Timeout na confirmação)

Área (ex.: pix) (opcional)

Evidências (um ou mais arquivos)

Clique Analisar → o backend:

Extrai texto das evidências (TXT/LOG/MD sempre; PDF/IMG se bibliotecas estiverem disponíveis).

Busca contexto via RAG.

Executa LLM com prompt específico e gera:

JSON (app/data/reports/<id>.json)

Markdown (app/data/reports/<id>.md)

Vá em QA → Relatórios para listar/abrir os resultados.

## 9) Endpoints Principais

GET /health — status

POST /api/ingest — { rebuild: boolean } (reindexação/ingest)

POST /api/chat — { message, top_k } → { answer, sources }

Admin

GET /api/admin/stats

POST /api/admin/sync — { rebuild: boolean }

GET /api/connectors / PUT /api/connectors/{name}

QA

POST /api/qa/analyze — multipart/form-data com case_title, area?, files[]

GET /api/qa/reports — lista metadados de relatórios

GET /api/qa/reports/{id} — relatório completo (JSON)

GET /api/qa/report_md/{id} — baixa/abre o Markdown

POST /api/qa/publish?report_id={id}&target=notion (placeholder)

## 10) Exemplos Rápidos
CSV de dunning (exemplo)
```
day,action,channel,notes
D0,Email reminder,Email,"Friendly reminder"
D3,SMS reminder,SMS,"Short message"
D7,Partial block,System,"Limit features"
D10,Second charge attempt,Billing,"Retry + log"
D14,Full suspension,System,"Suspend access"
D30,Cancel,Billing,"Close account"
```

Salve em backend/app/data/docs/dunning_schedule.csv.

Admin → Reindexar.

Pergunte no chat: “Qual o fluxo de dunning sugerido no CSV?”.

## 11) Troubleshooting
CORS: garanta CORS_ORIGINS=http://localhost:3000 no backend.

Vetores = 0: verifique formatos em app/data/docs e se reconstruiu o índice.

Notion/Drive: habilitar credenciais em connectors.json.

LM Studio: set USE_LM_STUDIO=true e OPENAI_BASE_URL=http://localhost:1234/v1.

## 12) Roadmap
Publicação Notion/GDrive dos relatórios QA

Matriz de políticas por área (YAML) com avaliação contextual

Métricas no Admin: PASS/FAIL por critério, heatmap de gaps

OCR robusto e modo “forçar OCR”

Autenticação (SSO), RBAC e auditoria