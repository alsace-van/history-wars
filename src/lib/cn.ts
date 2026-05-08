// v1.0 (08/05/2026) — utilitaire cn pour merger classes Tailwind
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
