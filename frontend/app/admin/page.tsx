'use client'
import React, { useEffect, useState } from 'react'
import { getAdminStats, listConnectors, updateConnector, syncAdmin } from '../../lib/api'

export default function AdminPage() {
  const [stats, setStats] = useState<any>({})
  const [conns, setConns] = useState<any>({})
  const [loading, setLoading] = useState(false)

  async function refresh() {
    const [s, c] = await Promise.all([getAdminStats(), listConnectors()])
    setStats(s)
    setConns(c)
  }

  useEffect(() => { refresh() }, [])

  async function toggle(name: string, enabled: boolean) {
    setLoading(true)
    try {
      await updateConnector(name, { enabled })
      await refresh()
    } finally { setLoading(false) }
  }

  async function doSync(full: boolean) {
    setLoading(true)
    try {
      const r = await syncAdmin(full)
      alert(`Sync ok. Vetores: ${r.vectors}`)
      await refresh()
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Administração</h1>
        <div className="flex gap-2">
          <button onClick={() => doSync(false)} className="px-3 py-2 rounded-xl bg-[var(--card)]">
            Sincronizar
          </button>
          <button onClick={() => doSync(true)} className="px-3 py-2 rounded-xl bg-[var(--card)]">
            Reindexar (full)
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-[var(--card)] p-4">
          <div className="text-sm opacity-70">Buscas feitas</div>
          <div className="text-3xl font-bold">{stats.searches ?? 0}</div>
        </div>
        <div className="rounded-2xl bg-[var(--card)] p-4">
          <div className="text-sm opacity-70">Chats iniciados</div>
          <div className="text-3xl font-bold">{stats.chats ?? 0}</div>
        </div>
        <div className="rounded-2xl bg-[var(--card)] p-4">
          <div className="text-sm opacity-70">Pontos vetorizados</div>
          <div className="text-3xl font-bold">{stats.vectors ?? 0}</div>
        </div>
      </section>

      <section className="rounded-2xl bg-[var(--card)] p-4">
        <h2 className="font-semibold mb-2">Conexões</h2>
        <ul className="divide-y divide-white/5">
          {Object.entries(conns).map(([name, cfg]: any) => (
            <li key={name} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{name}</div>
                <div className="text-xs opacity-70 truncate max-w-md">
                  {name === 'local' ? `path: ${cfg.path}` :
                   name === 'urls'  ? `urls: ${(cfg.list||[]).join(', ')}` : 'configurar credenciais…'}
                </div>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <span className="text-sm">{cfg.enabled ? 'Ativo' : 'Inativo'}</span>
                <input
                  type="checkbox"
                  checked={!!cfg.enabled}
                  onChange={e => toggle(name, e.target.checked)}
                  disabled={loading}
                />
              </label>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs opacity-70">
        Dica: edite <code>backend/app/data/connectors.json</code> para incluir Notion, Google Drive ou M365. Ative o conector e clique em “Sincronizar”.
      </p>
    </div>
  )
}
