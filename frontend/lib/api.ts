// lib/api.ts
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function jsonFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${text}`);
  }
  return res.json();
}

/** =========================
 *  Chat / RAG (já existentes)
 *  ========================= */
export async function askChronos(message: string, top_k = 4) {
  return jsonFetch(`${BACKEND_URL}/api/chat`, {
    method: "POST",
    body: JSON.stringify({ message, top_k }),
  });
}

export async function rebuildIndex() {
  return jsonFetch(`${BACKEND_URL}/api/ingest`, {
    method: "POST",
    body: JSON.stringify({ rebuild: true }),
  });
}

export async function getAdminStats() {
  const r = await fetch(`${BACKEND_URL}/api/admin/stats`, { cache: 'no-store' })
  if (!r.ok) throw new Error('stats error')
  return r.json()
}

export async function listConnectors() {
  const r = await fetch(`${BACKEND_URL}/api/connectors`, { cache: 'no-store' })
  if (!r.ok) throw new Error('connectors error')
  return r.json()
}

export async function updateConnector(name: string, patch: any) {
  const r = await fetch(`${BACKEND_URL}/api/connectors/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  })
  if (!r.ok) throw new Error('update connector error')
  return r.json()
}

export async function syncAdmin(full = false) {
  const r = await fetch(`${BACKEND_URL}/api/admin/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rebuild: full })
  })
  if (!r.ok) throw new Error('sync error')
  return r.json()
}

/** =========================
 *  QA (Cronos QA+)
 *  ========================= */
export type ReportItem = {
  id: string
  title?: string
  area?: string | null
  created_at?: string
  report_json_path?: string
  report_markdown_path?: string | null
}

export type ReportFull = ReportItem & {
  inputs?: { case_title?: string; evidences?: string[] }
  extracted?: { text?: string }
  llm_raw?: string
  evaluation?: {
    criteria?: { name: string; result: string; reason?: string }[]
  } | null
  suggestions?: { description: string; details?: string }[] | null
}

// Upload + análise (usa FormData; não usar jsonFetch porque o Content-Type é multipart)
export async function qaAnalyze(form: FormData) {
  const r = await fetch(`${BACKEND_URL}/api/qa/analyze`, {
    method: 'POST',
    body: form,
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Falha ao analisar: ${r.status} ${r.statusText} — ${text}`);
  }
  return (await r.json()) as ReportFull;
}

// Lista de relatórios
export async function qaListReports() {
  const r = await fetch(`${BACKEND_URL}/api/qa/reports`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Falha ao listar relatórios');
  return (await r.json()) as ReportItem[];
}

// Detalhe de relatório
export async function qaGetReport(id: string) {
  const r = await fetch(`${BACKEND_URL}/api/qa/reports/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Relatório não encontrado');
  return (await r.json()) as ReportFull;
}

// URL para baixar o Markdown (link direto)
export const qaReportMDUrl = (id: string) =>
  `${BACKEND_URL}/api/qa/report_md/${encodeURIComponent(id)}`;

// (Opcional) Publicar relatório no Notion/Drive (se backend habilitar)
export async function qaPublish(reportId: string, target: 'notion' | 'gdrive' = 'notion') {
  const r = await fetch(`${BACKEND_URL}/api/qa/publish?report_id=${encodeURIComponent(reportId)}&target=${encodeURIComponent(target)}`, {
    method: 'POST',
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Falha ao publicar: ${r.status} ${r.statusText} — ${text}`);
  }
  return r.json();
}
