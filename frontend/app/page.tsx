// app/page.tsx
'use client'
import React, { useState, useEffect, useRef } from 'react'
import MessageBubble from '../components/MessageBubble'
import InputBar from '../components/InputBar'
import Sidebar from '../components/Sidebar'
import { askChronos, rebuildIndex } from '../lib/api'

type Msg = { role: 'user' | 'assistant', text: string }

export default function HomePage() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'assistant', text: 'Oi, eu sou o Chronos. Coloque arquivos em /backend/app/data/docs e clique em "Reindexar" para eu aprender. Como posso ajudar?' }
  ])
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [msgs])

  async function onSend(text: string) {
    setMsgs(prev => [...prev, { role: 'user', text }])
    setLoading(true)
    try {
      const res = await askChronos(text, 4)

      const fontes = (res.sources || [])
        .map((s: any) => `- ${s.source}${s.page != null ? ` (p.${s.page})` : ''}`)
        .join('\n')
      const final = fontes ? res.answer + "\n\nFontes:\n" + fontes : res.answer
      setMsgs(prev => [...prev, { role: 'assistant', text: final }])
    } catch (e: any) {
      setMsgs(prev => [...prev, { role: 'assistant', text: 'Erro ao consultar o Chronos: ' + e.message }])
    } finally {
      setLoading(false)
    }
  }

  async function onRebuild() {
    setLoading(true)
    try {
      const r = await rebuildIndex()
      setMsgs(prev => [...prev, { role: 'assistant', text: `Índice reconstruído com sucesso! Vetores processados: ${r.vectors ?? '—'}` }])
    } catch (e: any) {
      setMsgs(prev => [...prev, { role: 'assistant', text: 'Falha ao reconstruir índice: ' + e.message }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-purple-50">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Menu Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg float-animation">
                <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-gray-800">Chronos</h1>
                <p className="text-xs text-gray-600">Bemobi Internal Agent</p>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${loading ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></div>
              <span className="text-sm text-gray-600 hidden sm:inline">
                {loading ? 'Processando...' : 'Online'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Card */}
        {msgs.length === 1 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-xl float-animation">
              <div className="w-12 h-12 rounded-full border-3 border-white flex items-center justify-center">
                <div className="w-4 h-4 bg-white rounded-full"></div>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Bem-vindo ao Chronos</h2>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Seu assistente inteligente para consulta de documentos internos. 
              Faça perguntas sobre seus arquivos e obtenha respostas precisas em tempo real.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Respostas precisas
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Processamento rápido
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Dados seguros
              </div>
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-h-[60vh] max-h-[70vh] overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            {msgs.map((m, i) => <MessageBubble key={i} role={m.role} text={m.text} />)}
            
            {/* Loading indicator */}
            {loading && (
              <div className="my-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
                  <div className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="inline-block px-6 py-4 bg-white border border-gray-200 rounded-2xl shadow-md">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-gray-500 text-sm">Chronos está pensando...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <InputBar onSend={onSend} onRebuild={onRebuild} loading={loading} />
          </div>
        </div>
      </main>
    </div>
  )
}
