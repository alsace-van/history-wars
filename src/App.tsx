// v1.0 (08/05/2026) — page d'accueil minimale Lot 1, valide le rendu Vite + Tailwind
import { env } from '@lib/env'

function App() {
  const supabaseConfigured = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY)

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col items-center justify-center font-sans">
      <h1 className="text-6xl font-bold tracking-wider mb-4">TACTICA</h1>
      <p className="text-text-secondary text-sm mb-8">
        Wargame hex tactique &mdash; batailles de France
      </p>
      <div className="flex gap-3 text-xs text-text-tertiary">
        <span className="px-3 py-1 rounded border border-bg-tertiary">
          Phase 0 &middot; Lot 1 OK
        </span>
        <span className={`px-3 py-1 rounded border ${supabaseConfigured ? 'border-accent-green text-accent-green' : 'border-accent-red text-accent-red'}`}>
          Supabase {supabaseConfigured ? 'configure' : 'manquant'}
        </span>
      </div>
    </div>
  )
}

export default App
