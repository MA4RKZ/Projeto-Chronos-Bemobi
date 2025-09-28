'use client'
import React from 'react'

export default function MessageBubble({ role, text }: { role: 'user' | 'assistant', text: string }) {
  return (
    <div className={`my-6 flex items-start gap-4 ${role === 'user' ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        {role === 'assistant' ? (
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg">
            <img 
              src="/chronos_chat_symbol.png" 
              alt="Chronos" 
              className="w-10 h-10 rounded-full"
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-3xl ${role === 'user' ? 'text-right' : ''}`}>
        <div className={`inline-block px-6 py-4 rounded-2xl shadow-md transition-all duration-300 hover:shadow-lg ${
          role === 'assistant' 
            ? 'bg-white border border-gray-200' 
            : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
        }`}>
          <div className={`whitespace-pre-wrap leading-relaxed ${
            role === 'assistant' ? 'text-gray-800' : 'text-white'
          }`}>
            {text}
          </div>
        </div>
        
        {/* Timestamp */}
        <div className={`mt-2 text-xs text-gray-500 ${role === 'user' ? 'text-right' : 'text-left'}`}>
          {new Date().toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    </div>
  )
}
