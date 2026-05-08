// v1.0 (08/05/2026) — fond global page : carte Austerlitz + overlay sombre
// Sera reutilise dans Game.tsx (sous-lot 4C).

const BG_OVERLAY = [
  'radial-gradient(ellipse at center, rgba(8,12,24,0.30) 0%, rgba(8,12,24,0.75) 80%)',
  'linear-gradient(180deg, rgba(8,12,24,0.30) 0%, rgba(8,12,24,0.65) 100%)'
].join(',')

export function PageBackground() {
  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 -z-20 bg-cover bg-center"
        style={{
          backgroundImage: "url('/scenes/austerlitz.png')",
          filter: 'saturate(1.05) contrast(1.05)'
        }}
      />
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{ background: BG_OVERLAY }}
      />
    </>
  )
}
