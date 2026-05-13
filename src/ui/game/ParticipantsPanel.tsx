// v1.0 (13/05/2026) — Phase 3.2-bis : volet compact des participants (1 ligne/joueur, hôte = point vert, moi = highlight)
// Remplace les deux TeamPanel pleins de BattleSidebar (refonte UX feedback user — sidebar surchargée).
import { useState } from 'react'
import type { SlotData } from '@ui/game/TeamPanel'

interface ParticipantsPanelProps {
  blueSlots: SlotData[]
  redSlots: SlotData[]
  hostUserId: string
  currentUserId: string
}

export function ParticipantsPanel({
  blueSlots,
  redSlots,
  hostUserId,
  currentUserId,
}: ParticipantsPanelProps) {
  const [expanded, setExpanded] = useState(false)

  const blueFilled = blueSlots.filter(s => s.player !== null).length
  const redFilled = redSlots.filter(s => s.player !== null).length

  return (
    <div className="border border-[rgba(226,232,240,0.18)] rounded-[2px] bg-[rgba(15,23,42,0.6)]">
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>
          Participants ·
          <span className="ml-2 text-tactica-blue-bright tabular-nums">{blueFilled}</span>
          <span className="opacity-40 mx-1">|</span>
          <span className="text-tactica-red-bright tabular-nums">{redFilled}</span>
        </span>
        <span className="text-[10px] opacity-60">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2">
          <TeamSection slots={blueSlots} team="blue" hostUserId={hostUserId} currentUserId={currentUserId} />
          <TeamSection slots={redSlots} team="red" hostUserId={hostUserId} currentUserId={currentUserId} />
        </div>
      )}
    </div>
  )
}

interface TeamSectionProps {
  slots: SlotData[]
  team: 'blue' | 'red'
  hostUserId: string
  currentUserId: string
}

function TeamSection({ slots, team, hostUserId, currentUserId }: TeamSectionProps) {
  const teamLabel = team === 'blue' ? 'Bleus' : 'Rouges'
  const teamColor = team === 'blue' ? 'text-tactica-blue-bright' : 'text-tactica-red-bright'
  const borderColor = team === 'blue' ? 'border-l-blue-500/60' : 'border-l-red-500/60'

  return (
    <div className={`border-l-2 ${borderColor} pl-2 space-y-[2px]`}>
      <div className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${teamColor} mb-1`}>
        {teamLabel}
      </div>
      {slots.map(s => (
        <PlayerLine
          key={s.index}
          slot={s}
          isHost={!!s.player && s.player.user_id === hostUserId}
          isMe={!!s.player && s.player.user_id === currentUserId}
        />
      ))}
    </div>
  )
}

interface PlayerLineProps {
  slot: SlotData
  isHost: boolean
  isMe: boolean
}

function PlayerLine({ slot, isHost, isMe }: PlayerLineProps) {
  const roleLabel = slot.role === 'general' ? 'Général' : 'Commandant'

  if (!slot.player) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60 italic">
        <span className="w-[6px] h-[6px] rounded-full bg-muted/30 shrink-0" />
        <span>Slot vacant</span>
        <span className="opacity-60">— {roleLabel}</span>
      </div>
    )
  }

  const name = slot.player.username ?? '—'
  return (
    <div
      className={`flex items-center gap-2 text-[11px] tabular-nums px-1 py-[1px] rounded-[2px] ${
        isMe ? 'bg-amber-400/15 text-amber-100 font-semibold' : 'text-foreground/85'
      }`}
    >
      <span
        className={`w-[6px] h-[6px] rounded-full shrink-0 ${
          isHost ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.7)]' : 'bg-muted/40'
        }`}
        title={isHost ? 'Hôte de la partie' : undefined}
      />
      <span className="truncate flex-1">
        {name}
        {isMe && <span className="ml-1 text-[9px] uppercase tracking-[0.15em] text-amber-300/80">(toi)</span>}
      </span>
      <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{roleLabel}</span>
    </div>
  )
}
