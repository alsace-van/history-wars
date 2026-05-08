// v1.0b (08/05/2026) — Routes /lobby + Toaster sonner, redirection / → /lobby
// v1.0a (08/05/2026) — Router avec /auth et / proteges
// v1.0 (08/05/2026) — page d'accueil minimale Lot 1, valide le rendu Vite + Tailwind
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Auth } from '@ui/pages/Auth'
import { Lobby } from '@ui/pages/Lobby'

function App() {
  return (
    <BrowserRouter>
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(20, 28, 50, 0.96)',
            border: '1px solid rgba(239, 159, 39, 0.4)',
            color: 'hsl(213 31% 91%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '13px',
            letterSpacing: '0.02em'
          }
        }}
      />
      <Routes>
        <Route path="/" element={<Navigate to="/lobby" replace />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="*" element={<Navigate to="/lobby" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
