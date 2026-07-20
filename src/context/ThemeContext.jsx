import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'mryum-theme'

// Each scheme has a dark data-theme id and a light data-theme id — the
// Settings page picks the scheme, the navbar icon flips dark/light while
// staying on whichever scheme is currently active.
export const SCHEMES = [
  { id: 'mint', label: 'Mint', dark: 'dark', light: 'light', swatch: ['#02F5A1', '#98cdbb', '#99b4e6'] },
  { id: 'sunset', label: 'Sunset', dark: 'sunset', light: 'sunset-light', swatch: ['#f55b02', '#cdac98', '#cae699'] },
  { id: 'berry', label: 'Berry', dark: 'berry', light: 'berry-light', swatch: ['#f502f5', '#cd98cd', '#e69999'] },
  { id: 'ocean', label: 'Ocean', dark: 'ocean', light: 'ocean-light', swatch: ['#02a4f5', '#98bbcd', '#b299e6'] },
  { id: 'amber', label: 'Amber', dark: 'amber', light: 'amber-light', swatch: ['#f5ac02', '#cdbd98', '#b0e699'] },
  { id: 'goldrush', label: 'Gold Rush', dark: 'goldrush', light: 'goldrush-light', swatch: ['#FDBF2D', '#000000'] },
  { id: 'solstice', label: 'Solstice', dark: 'solstice', light: 'solstice-light', swatch: ['#FAF92A', '#002147'] },
  { id: 'moonlight', label: 'Moonlight', dark: 'moonlight', light: 'moonlight-light', swatch: ['#FFFF99', '#000066'] },
  { id: 'lagoon', label: 'Lagoon', dark: 'lagoon', light: 'lagoon-light', swatch: ['#99CC33', '#003333'] },
  { id: 'meadow', label: 'Meadow', dark: 'meadow', light: 'meadow-light', swatch: ['#FAF92A', '#006633'] },
  { id: 'cardinal', label: 'Cardinal', dark: 'cardinal', light: 'cardinal-light', swatch: ['#FFCC99', '#990000'] },
  { id: 'harbor', label: 'Harbor', dark: 'harbor', light: 'harbor-light', swatch: ['#ADDFF1', '#003152'] },
]

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    return localStorage.getItem(STORAGE_KEY) || 'dark'
  })

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const currentScheme = SCHEMES.find((s) => s.dark === theme || s.light === theme) || SCHEMES[0]
  const mode = currentScheme.light === theme ? 'light' : 'dark'

  const setScheme = (schemeId) => {
    const scheme = SCHEMES.find((s) => s.id === schemeId)
    if (!scheme) return
    setThemeState(mode === 'light' ? scheme.light : scheme.dark)
  }

  const toggleTheme = () => setThemeState(mode === 'light' ? currentScheme.dark : currentScheme.light)

  return (
    <ThemeContext.Provider value={{ theme, mode, scheme: currentScheme.id, setScheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
