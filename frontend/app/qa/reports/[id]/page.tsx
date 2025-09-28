'use client'
import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { qaGetReport, qaReportMDUrl, ReportFull } from '@/lib/api'

export default function QaReportDetail() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const params = useParams<{ id: string }>()
  const id = decodeURIComponent(params.id as string)

  const [data, setData] = useState<ReportFull | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showExtract, setShowExtract] = useState(false)

  useEffect(() => {
    (async () => {
      setLoading(true)
      setErr(null)
      try {
        const j = await qaGetReport(id)
        // Se o backend ainda não insere evaluation/suggestions estruturados, mostrará só raw
        setData(j)
      } catch (e: any) {
        setErr(e?.message || 'Falha ao carregar')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (loading) return <div className="p-6">Carregando…</div>
  if (err) return <div className="p-6 text-red-600">{err}</div>
  if (!data) return <div className="p-6">Relatório não encontrado.</div>

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
          <h1 className="text-xl font-bold text-gray-800">Relatório: {data.id}</h1>
          <div />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="p-4 bg-white rounded-2xl shadow border border-gray-200">
          <div><b>Título:</b> {data.title || '-'}</div>
          <div><b>Área:</b> {data.area || '-'}</div>
          <div><b>Criado em:</b> {data.created_at || '-'}</div>
          <div className="mt-2">
            <a className="text-blue-600 underline" href={qaReportMDUrl(data.id)} target="_blank">
              Abrir/baixar Markdown
            </a>
          </div>
        </div>

        <div className="mt-4 p-4 bg-white rounded-2xl shadow border border-gray-200">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Trecho extraído</div>
            <button
              onClick={() => setShowExtract(s => !s)}
              className="text-sm text-gray-700 underline"
            >
              {showExtract ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          {showExtract && (
            <pre className="mt-2 bg-gray-100 p-3 text-xs overflow-auto rounded">
              {data.extracted?.text || '-'}
            </pre>
          )}
        </div>

        {data.evaluation?.criteria?.length ? (
          <div className="mt-4 p-4 bg-white rounded-2xl shadow border border-gray-200">
            <div className="font-semibold mb-2">Critérios</div>
            <div className="space-y-2">
              {data.evaluation.criteria.map((c, i) => (
                <div key={i} className="p-3 border border-gray-200 rounded-xl">
                  <div className="flex gap-2 items-center">
                    <span className="text-blue-700 font-medium">{c.name}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      (c.result||'').toUpperCase().includes('OK') || (c.result||'').toUpperCase().includes('PASS')
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>{c.result}</span>
                  </div>
                  {c.reason && <div className="text-sm text-gray-600 mt-1">{c.reason}</div>}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {data.suggestions?.length ? (
          <div className="mt-4 p-4 bg-white rounded-2xl shadow border border-gray-200">
            <div className="font-semibold mb-2">Sugestões</div>
            <div className="space-y-2">
              {data.suggestions.map((s, i) => (
                <div key={i} className="p-3 border border-gray-200 rounded-xl">
                  <div className="font-medium">{s.description}</div>
                  {s.details && <div className="text-sm text-gray-600">{s.details}</div>}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 p-4 bg-white rounded-2xl shadow border border-gray-200">
          <div className="font-semibold mb-2">Saída do LLM (raw)</div>
          <pre className="bg-gray-100 p-3 text-xs overflow-auto rounded">
            {data.llm_raw || '-'}
          </pre>
        </div>
      </main>
    </div>
  )
}
