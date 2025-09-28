'use client'
import React, { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { qaAnalyze, ReportFull } from '@/lib/api'

export default function QaUploadPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [caseTitle, setCaseTitle] = useState('')
  const [area, setArea] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [result, setResult] = useState<ReportFull | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!caseTitle || !files || files.length === 0) {
      setErr('Preencha o título e selecione pelo menos 1 arquivo.')
      return
    }

    const fd = new FormData()
    fd.append('case_title', caseTitle)
    if (area) fd.append('area', area)
    Array.from(files).forEach(f => fd.append('files', f))

    setLoading(true)
    try {
      const r = await qaAnalyze(fd)
      setResult(r)
    } catch (e: any) {
      setErr(e?.message || 'Falha ao analisar')
    } finally {
      setLoading(false)
    }
  }

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
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-800">QA • Upload de Evidências</h1>
          </div>
          <div />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <input
              className="border border-gray-300 rounded-xl p-3 w-full"
              placeholder="Título do caso (ex: PIX - timeout)"
              value={caseTitle}
              onChange={e => setCaseTitle(e.target.value)}
            />
            <input
              className="border border-gray-300 rounded-xl p-3 w-full"
              placeholder="Área (ex: pix, debit_recurring) — opcional"
              value={area}
              onChange={e => setArea(e.target.value)}
            />
            <input
              type="file"
              multiple
              onChange={e => setFiles(e.target.files)}
              className="border border-gray-300 rounded-xl p-3 w-full"
              accept=".pdf,.doc,.docx,.txt,.md,.log,.csv,.png,.jpg,.jpeg"
            />
            <button
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Analisando...' : 'Analisar'}
            </button>
            {err && <div className="text-red-600 text-sm">{err}</div>}
          </form>
        </div>

        {result && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mt-6">
            <div className="font-semibold">{result.title}</div>
            <div className="text-sm text-gray-600">ID: {result.id}</div>
            <div className="text-sm text-gray-600">
              MD: {result.report_markdown_path || '—'}
            </div>

            <pre className="mt-4 bg-gray-100 p-3 text-xs overflow-auto rounded">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </main>
    </div>
  )
}
