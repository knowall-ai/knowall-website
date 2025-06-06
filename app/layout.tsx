import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "KnowAll.ai - AI Consultancy & Agent Development",
  description: "AI consultancy specializing in agent development and Bitcoin-powered value-for-value transactions.",
  generator: 'v0.dev',
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
    shortcut: '/favicon.ico'
  },
  metadataBase: new URL('https://knowall.ai'),
  keywords: ['AI', 'artificial intelligence', 'consultancy', 'chatbot', 'Bitcoin', 'Lightning Network'],
  robots: {
    index: true,
    follow: true
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preload" as="image" href="/images/green-bg.png" />
        {/* Only apply CSP in production, not in development */}
        {process.env.NODE_ENV === 'production' && (
          <>                                                            
            <meta httpEquiv="Content-Security-Policy" content="upgrade-insecure-requests; default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;" />
            <meta httpEquiv="Strict-Transport-Security" content="max-age=31536000; includeSubDomains" />
          </>
        )}
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
