// v1.0 (09/05/2026) — Phase 1 L1B.2 : extraction user authenticated via JWT
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

export interface AuthedUser {
  userId: string
  email: string | null
}

/**
 * Extrait le user authenticated depuis l'Authorization header.
 * Retourne null si JWT absent / invalide.
 */
export async function extractUserFromJWT(req: Request): Promise<AuthedUser | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return null

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await userClient.auth.getUser()
  if (error || !data.user) return null

  return { userId: data.user.id, email: data.user.email ?? null }
}
