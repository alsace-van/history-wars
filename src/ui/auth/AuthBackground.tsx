// v1.0b (08/05/2026) — bascule vers images reelles, overlay renforce pour citations
// v1.0a (08/05/2026) — Carrousel 4 slides, 8s, Ken Burns + fade, citations sync
// v1.0 (08/05/2026) — SVG unique (avant carrousel)
import { useEffect, useState } from 'react'
import { Typewriter } from '@ui/components/Typewriter'

interface Slide {
  src: string
  alt: string
  quote: string
  author: string
  position?: string
}

const SLIDES: Slide[] = [
  {
    src: '/scenes/bouvines.png',
    alt: 'Bataille de Bouvines, 1214',
    quote: "Connaitre l'adversaire et se connaitre soi-meme : en cent batailles, jamais en peril.",
    author: 'Sun Tzu',
    position: 'center'
  },
  {
    src: '/scenes/austerlitz.png',
    alt: "Carte de la bataille d'Austerlitz, 1805",
    quote: "Le genie de la guerre est de bien voir tout d'un coup d'oeil.",
    author: 'Napoleon Bonaparte',
    position: 'center'
  },
  {
    src: '/scenes/verdun.png',
    alt: 'Carte de la bataille de Verdun, 1916',
    quote: 'Ils ne passeront pas.',
    author: 'Robert Nivelle, Verdun, 1916',
    position: 'center'
  }
]

const TEMPO_MS = 8000

export function AuthBackground() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length)
    }, TEMPO_MS)
    return () => clearInterval(id)
  }, [])

  const current = SLIDES[index]

  return (
    <>
      <div className="absolute inset-0 overflow-hidden bg-[#0a1224]">
        {SLIDES.map((slide, i) => {
          const isActive = i === index
          return (
            <div
              key={i}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                isActive ? 'opacity-100 animate-kenburns' : 'opacity-0'
              }`}
              aria-hidden={!isActive}
            >
              <img
                src={slide.src}
                alt={slide.alt}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: slide.position ?? 'center' }}
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            </div>
          )
        })}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background to-transparent" />

      <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-10">
        <blockquote className="space-y-2 text-center">
          <p className="text-base italic font-light text-text-primary leading-relaxed mx-auto max-w-md drop-shadow-md">
            &laquo;{' '}
            <Typewriter key={`q-${index}`} text={current.quote} speed={45} />{' '}
            &raquo;
          </p>
          <cite className="block text-xs text-muted-foreground not-italic">
            &mdash; {current.author}
          </cite>
        </blockquote>
      </div>
    </>
  )
}
