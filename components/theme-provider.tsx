'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Use a state to track if we're mounted on the client
  const [mounted, setMounted] = React.useState(false)

  // Set mounted to true after the component is mounted on the client
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent theme flashing by only rendering the provider when mounted
  if (!mounted) {
    // Return children without theme provider during SSR to avoid hydration mismatch
    return <>{children}</>
  }

  return (
    <NextThemesProvider {...props}>
      {children}
    </NextThemesProvider>
  )
}
