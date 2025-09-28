'use client'
import React, { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { qaListReports, ReportItem, qaReportMDUrl } from '@/lib/api'

export default function QaReportsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [items, setItems] = useState<ReportItem[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      setErr(null)
      try {
        const j = await qaListReports()
        setItems(j || [])
      } catch (e: any) {
        setErr(e?.message || 'Falha ao carregar relatórios')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-800">QA • Relatórios</h1>
          <div />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && <div>Carregando…</div>}
        {err && <div className="text-red-600">{err}</div>}
        {!loading && items.length === 0 && <div>Nenhum relatório encontrado.</div>}

        <div className="grid gap-4 mt-4">
          {items.map(it => (
            <div key={it.id} className="p-4 bg-white rounded-2xl shadow border border-gray-200">
              <div className="font-semibold">{it.title || it.id}</div>
              <div className="text-sm text-gray-600">
                Área: {it.area || '-'} • Criado: {it.created_at || '-'}
              </div>
              <div className="mt-2 flex gap-4 text-blue-600 text-sm">
                <Link href={`/qa/reports/${encodeURIComponent(it.id)}`} className="underline">
                  Ver detalhes
                </Link>
                <a href={qaReportMDUrl(it.id)} target="_blank" className="underline">
                  Baixar MD
                </a>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
