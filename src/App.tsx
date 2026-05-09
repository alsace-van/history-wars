// v1.0d (09/05/2026) — Route /render-test pour Lot 6A (demo scene 3D)
// v1.0c (08/05/2026) — Route /game/:id ajoutee
// v1.0b (08/05/2026) — Routes /lobby + Toaster sonner, redirection / → /lobby
// v1.0a (08/05/2026) — Router avec /auth et / proteges
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Auth } from '@ui/pages/Auth'
import { Lobby } from '@ui/pages/Lobby'
import { Game } from '@ui/pages/Game'
import { RenderTest } from '@ui/pages/RenderTest'

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
        <Route path="/game/:id" element={<Game />} />
        <Route path="/render-test" element={<RenderTest />} />
        <Route path="*" element={<Navigate to="/lobby" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
