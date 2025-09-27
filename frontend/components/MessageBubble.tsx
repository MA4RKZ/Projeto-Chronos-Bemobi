'use client'
import React from 'react'

export default function MessageBubble({ role, text }: { role: 'user' | 'assistant', text: string }) {
  return (
    <div className={`bubble ${role} ${role === 'user' ? 'user' : 'assistant'} my-2`}>
      {text}
    </div>
  )
}
