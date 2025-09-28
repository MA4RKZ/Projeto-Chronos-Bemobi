'use client'
import React, { useState, useRef } from 'react'
import { uploadDocuments } from '../lib/api'   // <= importar a função do api.ts

interface InputBarProps {
  onSend: (text: string) => void
  onRebuild: () => void
  loading: boolean
}

export default function InputBar({ onSend, onRebuild, loading }: InputBarProps) {
  const [value, setValue] = useState('')
  const [showActions, setShowActions] = useState(false)
  const [uploading, setUploading] = useState(false)      // <= novo
  const fileInputRef = useRef<HTMLInputElement>(null)

  const disabledSend = loading || uploading || !value.trim()

  function submit() {
    if (disabledSend) return
    onSend(value.trim())
    setValue('')
  }

  function handleFileUpload() {
    // abre o seletor
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (!files.length) return

    // valida extensões compatíveis com o backend
    const allowed = ['.pdf', '.txt', '.md', '.csv']
    const notAllowed = files.filter(f => {
      const ext = (f.name.split('.').pop() || '').toLowerCase()
      return !allowed.includes('.' + ext)
    })
    if (notAllowed.length) {
      alert(`Alguns arquivos não são suportados: ${notAllowed.map(f => f.name).join(', ')}.
Permitidos: ${allowed.join(', ')}`)
      // limpa o input para permitir re-selecionar os mesmos arquivos
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploading(true)
    try {
      // reindex = true para já reconstruir após upload
      const res = await uploadDocuments(files, true)
      // feedback na UI
      const uploadedNames = (res.saved || []).map((s: any) => s.file).join(', ')
      const vetores = res.vectors ?? '—'
      alert(`${files.length} arquivo(s) enviado(s): ${uploadedNames}\nVetores processados: ${vetores}`)

      // opcional: “mensagem” do assistente na conversa confirmando o upload
      onSend(`Arquivos anexados com sucesso. Agora posso responder baseado neles!`)
      setValue('')
    } catch (err: any) {
      alert('Falha no upload: ' + (err?.message || 'erro'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="relative">
      {/* Input principal */}
      <div className="chronos-card p-4">
        <div className="flex gap-3 items-end">
          {/* Botão de ações */}
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white flex items-center justify-center hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60"
              title="Mais ações"
              disabled={loading || uploading}
            >
              <svg className={`w-5 h-5 transition-transform duration-200 ${showActions ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>

            {/* Menu de ações */}
            {showActions && (
              <div className="absolute bottom-12 left-0 bg-white rounded-xl shadow-xl border border-gray-200 p-2 min-w-48 z-10">
                <button
                  onClick={() => { onRebuild(); setShowActions(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-60"
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
                  onClick={() => { handleFileUpload(); setShowActions(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-60"
                  disabled={loading || uploading}
                >
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium">Anexar arquivos</span>
                </button>
              </div>
            )}
          </div>

          {/* Input de texto */}
          <input
            className="chronos-input flex-1"
            placeholder={uploading ? "Enviando arquivos..." : "Pergunte algo dos documentos..."}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={loading || uploading}
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
              disabledSend 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-md hover:shadow-lg'
            }`}
            disabled={disabledSend} 
            onClick={submit}
          >
            {(loading || uploading) ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {uploading ? 'Enviando...' : 'Processando...'}
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
        accept=".pdf,.txt,.md,.csv"   // <= alinhado com o backend
      />
    </div>
  )
}
