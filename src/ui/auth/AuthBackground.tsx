// v1.0a (08/05/2026) — Carrousel 4 slides, 8s, Ken Burns + fade, citations sync
// v1.0 (08/05/2026) — SVG unique (avant carrousel)
import { useEffect, useState } from 'react'
import { Typewriter } from '@ui/components/Typewriter'
import { SceneInfantryMarch } from './scenes/SceneInfantryMarch'
import { SceneCavalryCharge } from './scenes/SceneCavalryCharge'
import { SceneBattleFormation } from './scenes/SceneBattleFormation'
import { SceneTopoMap } from './scenes/SceneTopoMap'

interface Slide {
  Scene: () => JSX.Element
  quote: string
  author: string
}

const SLIDES: Slide[] = [
  {
    Scene: SceneInfantryMarch,
    quote: "Le genie de la guerre est de bien voir tout d'un coup d'oeil.",
    author: 'Napoleon Bonaparte'
  },
  {
    Scene: SceneCavalryCharge,
    quote: "Connaitre l'adversaire et se connaitre soi-meme : en cent batailles, jamais en peril.",
    author: 'Sun Tzu'
  },
  {
    Scene: SceneBattleFormation,
    quote: "En guerre, le moral fait les trois quarts ; les forces reelles, l'autre quart.",
    author: 'Napoleon Bonaparte'
  },
  {
    Scene: SceneTopoMap,
    quote: "La guerre est la continuation de la politique par d'autres moyens.",
    author: 'Carl von Clausewitz'
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
      <div className="absolute inset-0 overflow-hidden">
        {SLIDES.map((slide, i) => {
          const Scene = slide.Scene
          const isActive = i === index
          return (
            <div
              key={i}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                isActive ? 'opacity-100 animate-kenburns' : 'opacity-0'
              }`}
              aria-hidden={!isActive}
            >
              <Scene />
            </div>
          )
        })}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />

      <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-10">
        <blockquote className="space-y-2 text-center">
          <p className="text-base italic font-light text-text-primary leading-relaxed mx-auto max-w-md">
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
