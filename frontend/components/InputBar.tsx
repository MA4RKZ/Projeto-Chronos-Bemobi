'use client'
import React, { useState, useRef } from 'react'
import { qaAnalyze, qaReportMDUrl } from '../lib/api'

interface InputBarProps {
  onSend: (text: string) => void
  onRebuild: () => void
  loading: boolean
  /** opcional: usada para empurrar uma mensagem de “sistema/assistant” no chat após upload */
  onQAResult?: (text: string) => void
}

export default function InputBar({ onSend, onRebuild, loading, onQAResult }: InputBarProps) {
  const [value, setValue] = useState('')
  const [showActions, setShowActions] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const disabled = loading || !value.trim()

  function submit() {
    if (disabled) return
    onSend(value.trim())
    setValue('')
  }

  function handleFileUpload() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    try {
      setUploading(true)

      // Monta título/área rápidos (você pode depois trocar por um modal)
      const names = Array.from(files).map(f => f.name).join(', ')
      const form = new FormData()
      form.append('case_title', `Upload rápido – ${names}`)
      // Se quiser setar uma área automática, descomente:
      // form.append('area', 'pix')

      Array.from(files).forEach(f => form.append('files', f))

      const report = await qaAnalyze(form)

      const mdLink = report?.id ? qaReportMDUrl(report.id) : null
      const msg = [
        `✅ **Upload analisado com sucesso!**`,
        ``,
        `**Título:** ${report?.title || '(sem título)'}`,
        `**ID:** ${report?.id}`,
        `**Área:** ${report?.area || '-'}`,
        report?.inputs?.evidences?.length
          ? `**Evidências:**\n${report.inputs.evidences.map(p => `- ${p}`).join('\n')}`
          : '',
        mdLink ? `**Baixar MD:** ${mdLink}` : ''
      ].filter(Boolean).join('\n')

      // Empurra uma mensagem no chat (se o Home passou o callback)
      onQAResult?.(msg)

      // Limpa input de arquivo para permitir re-selecionar o mesmo arquivo
      e.target.value = ''
    } catch (err: any) {
      const m = `❌ Falha no upload/análise: ${err?.message || err}`
      onQAResult?.(m)
      e.target.value = ''
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="relative">
      {/* Input principal */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4">
        <div className="flex gap-3 items-end">
          {/* Botão de ações */}
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white flex items-center justify-center hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
              title="Mais ações"
            >
              <svg className={`w-5 h-5 transition-transform duration-200 ${showActions ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>

            {/* Menu de ações */}
            {showActions && (
              <div className="absolute bottom-12 left-0 bg-white rounded-xl shadow-xl border border-gray-200 p-2 min-w-48 z-10">
                <button
                  onClick={() => {
                    onRebuild()
                    setShowActions(false)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  disabled={loading || uploading}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium">Reindexar</span>
                </button>
                
                <button
                  onClick={() => {
                    handleFileUpload()
                    setShowActions(false)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  disabled={uploading}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium">
                    {uploading ? 'Enviando...' : 'Anexar arquivos'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Input de texto */}
          <input
            className="flex-1 px-4 py-3 rounded-xl outline-none bg-gray-50 border border-gray-200 focus:border-blue-400 focus:bg-white transition-all duration-200"
            placeholder="Pergunte algo dos documentos..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
          />

          {/* Botão de enviar */}
          <button 
            className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              disabled 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg'
            }`}
            disabled={disabled} 
            onClick={submit}
          >
            {(loading || uploading) ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {uploading ? 'Enviando...' : 'Enviando...'}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Enviar
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Input de arquivo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.txt,.md,.csv,.log"
      />
    </div>
  )
}
