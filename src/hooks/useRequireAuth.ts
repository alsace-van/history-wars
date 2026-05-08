// v1.0 (08/05/2026) — Hook : redirige vers /auth si pas connecte
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'

export function useRequireAuth() {
  const auth = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      navigate('/auth?mode=signin', { replace: true })
    }
  }, [auth.loading, auth.user, navigate])

  return auth
}
