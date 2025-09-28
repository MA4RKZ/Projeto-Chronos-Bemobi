'use client'
import React, { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar'
import { getAdminStats, listConnectors, updateConnector, syncAdmin } from '../../lib/api'

export default function AdminPage() {
  const [stats, setStats] = useState<any>({})
  const [conns, setConns] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
      alert(`Sincronização concluída! Vetores processados: ${r.vectors}`)
      await refresh()
    } finally { setLoading(false) }
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
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
                <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-gray-800">Administração</h1>
                <p className="text-xs text-gray-600">Painel de controle do Chronos</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button 
                onClick={() => doSync(false)} 
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
                disabled={loading}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="hidden sm:inline">Sincronizar</span>
              </button>
              <button 
                onClick={() => doSync(true)} 
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl text-sm font-medium hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
                disabled={loading}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="hidden sm:inline">Reindexar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="chronos-card p-6 bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-blue-600 font-medium mb-1">Buscas feitas</div>
                <div className="text-3xl font-bold text-blue-800">{stats.searches ?? 0}</div>
                <div className="text-xs text-blue-600 mt-1">Total de consultas</div>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="chronos-card p-6 bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-green-600 font-medium mb-1">Chats iniciados</div>
                <div className="text-3xl font-bold text-green-800">{stats.chats ?? 0}</div>
                <div className="text-xs text-green-600 mt-1">Conversas ativas</div>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="chronos-card p-6 bg-gradient-to-br from-purple-50 to-purple-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-purple-600 font-medium mb-1">Pontos vetorizados</div>
                <div className="text-3xl font-bold text-purple-800">{stats.vectors ?? 0}</div>
                <div className="text-xs text-purple-600 mt-1">Dados processados</div>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* Connections Section */}
        <section className="chronos-card p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Dados em falta</h2>
              <p className="text-gray-600 mt-1">Gerencie as fontes de dados do sistema</p>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
              Object.values(conns).some((cfg: any) => cfg.enabled) 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                Object.values(conns).some((cfg: any) => cfg.enabled) ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              {Object.values(conns).some((cfg: any) => cfg.enabled) ? 'Conectado' : 'Desconectado'}
            </div>
          </div>
          
          <div className="space-y-4">
            {Object.entries(conns).map(([name, cfg]: any) => (
              <div key={name} className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border border-gray-200 hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    cfg.enabled ? 'bg-green-100' : 'bg-gray-200'
                  }`}>
                    {name === 'local' ? (
                      <svg className={`w-6 h-6 ${cfg.enabled ? 'text-green-600' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 1v6m8-6v6" />
                      </svg>
                    ) : (
                      <svg className={`w-6 h-6 ${cfg.enabled ? 'text-green-600' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 capitalize">{name}</div>
                    <div className="text-sm text-gray-600 truncate max-w-md">
                      {name === 'local' ? `Caminho: ${cfg.path}` :
                       name === 'urls'  ? `URLs: ${(cfg.list||[]).join(', ')}` : 'Configurar credenciais...'}
                    </div>
                  </div>
                </div>
                
                <label className="inline-flex items-center gap-3 cursor-pointer">
                  <span className={`text-sm font-medium ${cfg.enabled ? 'text-green-600' : 'text-gray-500'}`}>
                    {cfg.enabled ? 'Selecionado' : 'Não selecionado'}
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={!!cfg.enabled}
                      onChange={e => toggle(name, e.target.checked)}
                      disabled={loading}
                      className="sr-only"
                    />
                    <div className={`w-12 h-6 rounded-full transition-colors ${cfg.enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${cfg.enabled ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`}></div>
                    </div>
                  </div>
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* Help Section */}
        <div className="mt-8 chronos-card p-6 bg-gradient-to-r from-orange-50 to-orange-100 border-l-4 border-orange-500">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-orange-800 mb-2">Dica de configuração</h3>
              <p className="text-orange-700 text-sm leading-relaxed">
                Edite o arquivo <code className="bg-orange-200 px-2 py-1 rounded text-xs">backend/app/data/connectors.json</code> para incluir 
                integrações com Notion, Google Drive ou Microsoft 365. Após a configuração, ative o conector desejado e clique em "Sincronizar" 
                para importar os dados.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
