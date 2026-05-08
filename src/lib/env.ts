// v1.0 (08/05/2026) — validation Zod des env vars, fail-fast au demarrage
import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL doit etre une URL valide'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY est requis')
})

const parsed = envSchema.safeParse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY
})

if (!parsed.success) {
  console.error('[TACTICA v1.0] Config env invalide:', parsed.error.flatten().fieldErrors)
  throw new Error('Variables d\'environnement manquantes ou invalides. Verifie .env.local')
}

export const env = parsed.data
