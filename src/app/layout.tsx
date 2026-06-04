import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "./providers"

export const metadata: Metadata = {
  title: "Vaekstkapital Dashboard",
  description: "Intern marketing & sales dashboard",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Montserrat:wght@300;400&display=swap" rel="stylesheet" />
      </head>
      <body>{<Providers>{children}</Providers>}</body>
    </html>
  )
}
