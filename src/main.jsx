import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
// Registers the app-shell service worker (see vite.config.js's VitePWA
// setup) — precaches the actual built HTML/JS/CSS at build time, so a cold
// tab open or hard refresh with no connection still loads the app instead
// of a browser error page. The offline-first data layer (Dexie/sync queue)
// already handles everything past that point; this only covers the shell.
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
