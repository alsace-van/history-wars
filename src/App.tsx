// v1.0a (08/05/2026) — Router avec /auth et / proteges
// v1.0 (08/05/2026) — page d'accueil minimale Lot 1, valide le rendu Vite + Tailwind
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Auth } from '@ui/pages/Auth'
import { Home } from '@ui/pages/Home'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
