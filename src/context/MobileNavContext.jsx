import { createContext, useContext, useState } from 'react'

const MobileNavContext = createContext(null)

export function MobileNavProvider({ children }) {
  const [open, setOpen] = useState(false)

  const value = {
    open,
    toggle: () => setOpen((v) => !v),
    close: () => setOpen(false),
  }

  return <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>
}

export function useMobileNav() {
  const ctx = useContext(MobileNavContext)
  if (!ctx) throw new Error('useMobileNav must be used within MobileNavProvider')
  return ctx
}
