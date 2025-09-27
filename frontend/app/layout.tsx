// app/layout.tsx
import "../styles/globals.css"
import React from "react"

export const metadata = {
  title: "BIA — Bemobi Internal Agent",
  description: "RAG para documentos internos",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
      </body>
    </html>
  )
}
