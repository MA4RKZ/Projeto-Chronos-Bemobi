// lib/api.ts
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function jsonFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${text}`);
  }
  return res.json();
}

export async function askBIA(message: string, top_k = 4) {
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
