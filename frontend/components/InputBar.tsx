'use client'
import React, { useState } from 'react'

export default function InputBar({ onSend, loading }: { onSend: (text: string) => void; loading: boolean }) {
  const [value, setValue] = useState('')
  const disabled = loading || !value.trim()

  function submit() {
    if (disabled) return
    onSend(value.trim())
    setValue('')
  }

  return (
    <div className="flex gap-2">
      <input
        className="input"
        placeholder="Pergunte algo dos documentos..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' ? submit() : null}
      />
      <button className="btn" disabled={disabled} onClick={submit}>
        {loading ? '...' : 'Enviar'}
      </button>
    </div>
  )
}
