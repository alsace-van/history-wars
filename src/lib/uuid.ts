// v1.0 (09/05/2026) — L1C.1 : genUUID v4 + fallback navs anciens (D12 idempotence)

/**
 * Genere un UUID v4. Utilise crypto.randomUUID() si dispo (navs modernes),
 * fallback Math.random sinon. Utilise pour client_action_id (idempotence D12).
 */
export function genUUID(): string {
  // Cast minimaliste : TS ne connait pas randomUUID dans tous les targets (voir piege #41)
  const c = (typeof crypto !== 'undefined' ? crypto : undefined) as
    | (Crypto & { randomUUID?: () => string })
    | undefined

  if (c?.randomUUID) {
    return c.randomUUID()
  }

  // Fallback : pseudo UUID v4 base sur Math.random. Suffit pour l'idempotence
  // (collision improbable sur la duree d'une partie).
  // eslint-disable-next-line no-console
  console.warn('[genUUID v1.0] crypto.randomUUID indisponible, fallback Math.random')
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  const bytes = new Array<number>(16)
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant
  const b = bytes.map(hex)
  return `${b[0]}${b[1]}${b[2]}${b[3]}-${b[4]}${b[5]}-${b[6]}${b[7]}-${b[8]}${b[9]}-${b[10]}${b[11]}${b[12]}${b[13]}${b[14]}${b[15]}`
}
