// v1.2 (17/05/2026) — Phase 5 Lot B (ext) : routes /editor/maps + /editor/map/:id
// v1.1 (17/05/2026) — Phase 5 Lot B.3 : route /editor/hex-templates
// v1.0f (09/05/2026) — Lot 7 : mount <UpdatePrompt /> pour notif nouvelle version SW
// v1.0e (09/05/2026) — Sous-lot 6B : suppression route /render-test
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Auth } from '@ui/pages/Auth'
import { Lobby } from '@ui/pages/Lobby'
import { Game } from '@ui/pages/Game'
import { HexTemplateLibrary } from '@ui/editor/HexTemplateLibrary'
import { MapsList } from '@ui/editor/MapsList'
import { MapEditor } from '@ui/editor/MapEditor'
import { UpdatePrompt } from '@ui/components/UpdatePrompt'

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
            letterSpacing: '0.02em',
          },
        }}
      />
      <UpdatePrompt />
      <Routes>
        <Route path="/" element={<Navigate to="/lobby" replace />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/game/:id" element={<Game />} />
        <Route path="/editor/hex-templates" element={<HexTemplateLibrary />} />
        <Route path="/editor/maps" element={<MapsList />} />
        <Route path="/editor/map/:id" element={<MapEditor />} />
        <Route path="*" element={<Navigate to="/lobby" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
