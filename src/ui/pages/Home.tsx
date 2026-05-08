// v1.0 (08/05/2026) — Home placeholder, protegee, affiche pseudo + bouton logout
import { useEffect, useState } from 'react'
import { useRequireAuth } from '@hooks/useRequireAuth'
import { Button } from '@ui/components/Button'
import { supabase } from '@lib/supabase'

interface Profile {
  username: string
}

export function Home() {
  const { user, loading, signOut } = useRequireAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let active = true

    supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!active) return
        setProfile(data)
        setProfileLoading(false)
      })

    return () => {
      active = false
    }
  }, [user])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background animate-fade-in font-sans">
      <h1 className="text-5xl font-bold tracking-[0.18em] text-foreground mb-2">TACTICA</h1>
      <p className="text-sm text-muted-foreground mb-8">
        {profileLoading
          ? 'Chargement du profil...'
          : `Bienvenue, ${profile?.username ?? user.email ?? 'soldat'}.`}
      </p>

      <div className="flex flex-wrap gap-3 justify-center mb-8">
        <span className="px-3 py-1 rounded-md border border-border text-xs text-muted-foreground">
          Phase 0 &middot; Lot 2 OK
        </span>
        <span className="px-3 py-1 rounded-md border border-tactica-green text-xs text-tactica-green">
          Auth fonctionnelle
        </span>
      </div>

      <Button variant="outline" size="sm" onClick={signOut}>
        Se deconnecter
      </Button>
    </div>
  )
}
