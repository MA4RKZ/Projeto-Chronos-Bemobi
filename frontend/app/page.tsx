// app/page.tsx
'use client'
import React, { useState } from 'react'
import MessageBubble from '../components/MessageBubble'
import InputBar from '../components/InputBar'
import { askBIA, rebuildIndex } from '../lib/api'

type Msg = { role: 'user' | 'assistant', text: string }

export default function HomePage() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'assistant', text: 'Oi, eu sou a BIA. Coloque arquivos em /backend/app/data/docs e clique em “Reindexar” para eu aprender. Como posso ajudar?' }
  ])
  const [loading, setLoading] = useState(false)

  async function onSend(text: string) {
    setMsgs(prev => [...prev, { role: 'user', text }])
    setLoading(true)
    try {
      const res = await askBIA(text, 4)
      const fontes = (res.sources || [])
        .map((s: any) => `- ${s.source}${s.page != null ? ` (p.${s.page})` : ''}`)
        .join('\n')
      const final = fontes ? res.answer + "\n\nFontes:\n" + fontes : res.answer
      setMsgs(prev => [...prev, { role: 'assistant', text: final }])
    } catch (e: any) {
      setMsgs(prev => [...prev, { role: 'assistant', text: 'Erro ao consultar a BIA: ' + e.message }])
    } finally {
      setLoading(false)
    }
  }

  async function onRebuild() {
    setLoading(true)
    try {
      const r = await rebuildIndex()
      setMsgs(prev => [...prev, { role: 'assistant', text: `Índice reconstruído. Vetores: ${r.vectors ?? '—'}` }])
    } catch (e: any) {
      setMsgs(prev => [...prev, { role: 'assistant', text: 'Falha ao reconstruir índice: ' + e.message }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="shell">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">BIA — Bemobi Internal Agent</h1>
        <div className="flex gap-2">
          <button onClick={onRebuild} className="btn">Reindexar</button>
          <a href="/admin" target="_blank" className="btn">Docs</a>
        </div>
      </header>

      <main className="rounded-2xl p-4 min-h-[60vh]" style={{ background: 'var(--card)' }}>
        {msgs.map((m, i) => <MessageBubble key={i} role={m.role} text={m.text} />)}
      </main>

      <InputBar onSend={onSend} loading={loading} />
    </div>
  )
}
