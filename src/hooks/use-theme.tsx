import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type Theme = 'midnight' | 'ivory'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'riwaq:theme'

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'midnight'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'midnight' || stored === 'ivory') return stored
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'ivory'
  } catch {
    /* localStorage may be unavailable in private mode — fall through. */
  }
  return 'midnight'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.lang = 'ar'
    document.documentElement.dir = 'rtl'
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'ivory' ? '#f6f1e6' : '#070c1b')
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore persistence failures */
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === 'midnight' ? 'ivory' : 'midnight'
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* ignore persistence failures */
      }
      return next
    })
  }, [])

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used inside a <ThemeProvider>.')
  }
  return context
}
