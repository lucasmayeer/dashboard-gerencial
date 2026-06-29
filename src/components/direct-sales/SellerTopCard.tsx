import { useState, useCallback, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { Crown, Medal } from "lucide-react"
import { cn } from "@/lib/utils"
import { MRR_BADGE_COLOR, NRR_BADGE_COLOR, fmt, fmtPct, pctColor } from "@/lib/directSalesUtils"
import { getInitials } from "@/lib/desempenhoUtils"

// ── Paleta por posição ─────────────────────────────────────────────────────────
const RANK_PALETTE = {
  1: {
    text: "#EAB308",
    textDim: "rgba(234,179,8,0.7)",
    bg: "rgba(234,179,8,0.07)",
    border: "rgba(234,179,8,0.30)",
    glow: "rgba(234,179,8,0.18)",
    shine: "rgba(234,179,8,0.22)",
  },
  2: {
    text: "#C0C8D4",
    textDim: "rgba(192,200,212,0.6)",
    bg: "rgba(192,200,212,0.07)",
    border: "rgba(192,200,212,0.25)",
    glow: "rgba(192,200,212,0.12)",
    shine: "rgba(192,200,212,0.18)",
  },
  3: {
    text: "#CD9B6A",
    textDim: "rgba(180,83,9,0.65)",
    bg: "rgba(180,83,9,0.07)",
    border: "rgba(180,83,9,0.27)",
    glow: "rgba(180,83,9,0.14)",
    shine: "rgba(180,83,9,0.20)",
  },
} as const

const MRR_BADGE = { bg: "rgba(113,75,103,0.18)", border: "rgba(113,75,103,0.40)", text: MRR_BADGE_COLOR }
const NRR_BADGE = { bg: "rgba(1,126,132,0.16)", border: "rgba(1,126,132,0.38)", text: NRR_BADGE_COLOR }


export type SellerTopCardProps = {
  rank: 1 | 2 | 3
  name: string
  teamName: string | null
  managerName?: string | null
  mrrAchieved: number
  mrrTarget: number
  mrrPct: number
  nrrAchieved: number
  nrrTarget: number
  nrrPct: number
  totalTarget?: number
  totalPct?: number
  avatarUrl?: string | null
  /** Extra Tailwind classes applied to the outer wrapper */
  className?: string
  /** If true, renders a wider horizontal-friendly layout */
  wide?: boolean
  /** Disables the confetti click effect */
  noConfetti?: boolean
}

type Particle = {
  id: number
  x: number
  startY: number
  size: number
  delay: number
  duration: number
  rot: number
  kind: "text" | "avatar"
  label: string   // text content or initials (fallback)
}

// ── CSS keyframe injetado uma vez ─────────────────────────────────────────────
const KEYFRAME_ID = "seller-top-confetti-kf-v2"
if (typeof document !== "undefined" && !document.getElementById(KEYFRAME_ID)) {
  const s = document.createElement("style")
  s.id = KEYFRAME_ID
  s.textContent = `
    @keyframes topConfettiRise {
      0%   { opacity: 0;   transform: translateY(0)      translateX(0)      rotate(var(--rot)) scale(0.6); }
      6%   { opacity: 1; }
      30%  {              transform: translateY(-35vh)   translateX(14px)   rotate(calc(var(--rot) + 6deg))  scale(1.05); }
      60%  {              transform: translateY(-72vh)   translateX(-9px)   rotate(calc(var(--rot) + 14deg)) scale(0.9);  opacity: 0.9; }
      100% { opacity: 0;   transform: translateY(-125vh) translateX(5px)    rotate(calc(var(--rot) + 24deg)) scale(0.45); }
    }
  `
  document.head.appendChild(s)
}

// ── Componente ────────────────────────────────────────────────────────────────
export function SellerTopCard({
  rank, name, teamName, managerName,
  mrrAchieved, mrrTarget, mrrPct,
  nrrAchieved, nrrTarget, nrrPct,
  totalTarget, totalPct,
  avatarUrl,
  className,
  wide = false,
  noConfetti = false,
}: SellerTopCardProps) {
  const p = RANK_PALETTE[rank]
  const initials = getInitials(name)
  const total = mrrAchieved + nrrAchieved
  const isFirst = rank === 1

  const [avatarError, setAvatarError] = useState(false)
  useEffect(() => { setAvatarError(false) }, [avatarUrl])

  const [particles, setParticles] = useState<Particle[]>([])
  const pidRef = useRef(0)

  const handleClick = useCallback(() => {
    if (noConfetti) return
    const topLabel = `#TOP${rank}`
    const textPool = [topLabel, topLabel, topLabel, "🔥", "🔥", "🎉"]
    const count = 56

    const spawned: Particle[] = Array.from({ length: count }, (_, i) => {
      const isAvatar = i % 7 === 0   // ~1 em cada 7 é avatar
      return {
        id: pidRef.current++,
        x: Math.random() * 100,
        startY: 100 + Math.random() * 18,
        size: isAvatar ? 28 + Math.random() * 18 : 9 + Math.random() * 30,
        delay: Math.random() * 600,
        duration: 2200 + Math.random() * 2000,
        rot: isAvatar ? (Math.random() - 0.5) * 20 : (Math.random() - 0.5) * 40,
        kind: isAvatar ? "avatar" : "text",
        label: isAvatar ? initials : textPool[Math.floor(Math.random() * textPool.length)],
      }
    })

    setParticles(prev => [...prev, ...spawned])
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !spawned.find(s => s.id === p.id)))
    }, 5000)
  }, [rank, noConfetti, initials])

  const confettiPortal = particles.length > 0 && createPortal(
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 9999 }}>
      {particles.map(pt => {
        const baseStyle: React.CSSProperties = {
          left: `${pt.x}vw`,
          top: `${pt.startY}vh`,
          animationName: "topConfettiRise",
          animationDuration: `${pt.duration}ms`,
          animationDelay: `${pt.delay}ms`,
          animationTimingFunction: "cubic-bezier(0.15, 0.85, 0.45, 1)",
          animationFillMode: "forwards",
          // @ts-ignore
          "--rot": `${pt.rot}deg`,
        }

        if (pt.kind === "avatar") {
          const dim = pt.size
          const showPhoto = !!avatarUrl && !avatarError
          return (
            <div
              key={pt.id}
              className="absolute select-none flex items-center justify-center font-black overflow-hidden"
              style={{
                ...baseStyle,
                width: dim,
                height: dim,
                fontSize: `${Math.round(dim * 0.38)}px`,
                borderRadius: "50%",
                background: p.bg,
                border: `2px solid ${p.border}`,
                color: p.text,
                boxShadow: `0 0 14px ${p.glow}, 0 0 4px ${p.text}44`,
              }}
            >
              {showPhoto ? (
                <img
                  src={avatarUrl!}
                  alt={pt.label}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                />
              ) : pt.label}
            </div>
          )
        }

        return (
          <span
            key={pt.id}
            className="absolute font-black tracking-widest uppercase select-none"
            style={{
              ...baseStyle,
              fontSize: `${pt.size}px`,
              color: p.text,
              textShadow: `0 0 14px ${p.glow}, 0 0 4px ${p.text}55`,
            }}
          >
            {pt.label}
          </span>
        )
      })}
    </div>,
    document.body
  )

  return (
    <>
      {confettiPortal}

      <div
        onClick={handleClick}
        className={cn(
          "group relative overflow-hidden rounded-2xl cursor-pointer",
          "glass-card transition-all duration-500",
          wide
            ? "p-7 flex flex-col gap-5"
            : "p-5 flex flex-col gap-4 hover:scale-[1.04] hover:-translate-y-1.5",
          !wide && isFirst && "scale-[1.025]",
          className,
        )}
        style={{
          border: `1px solid ${p.border}`,
          boxShadow: `0 4px 32px ${p.glow}, 0 1px 0 rgba(255,255,255,0.05) inset`,
        }}
      >
        {/* Shine no topo */}
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-2xl"
          style={{ background: `linear-gradient(90deg, transparent, ${p.shine}, transparent)` }}
        />

        {/* Badge de posição */}
        <div className={cn("absolute flex flex-col items-center gap-0.5", wide ? "top-5 left-5" : "top-3 left-3")}>
          <div
            className={cn("inline-flex items-center justify-center rounded-full", wide ? "w-8 h-8" : "w-7 h-7")}
            style={{ background: p.bg, border: `1px solid ${p.border}`, color: p.text }}
          >
            {rank === 1
              ? <Crown className={wide ? "h-4 w-4" : "h-4 w-4"} style={{ color: p.text }} />
              : <Medal className={wide ? "h-4 w-4" : "h-4 w-4"} style={{ color: p.text }} />}
          </div>
          <span
            className="text-[9px] font-black tracking-widest uppercase leading-none"
            style={{ color: p.text }}
          >
            #TOP{rank}
          </span>
        </div>

        {wide ? (
          /* ── Wide layout: horizontal header + vertical breakdown ── */
          <>
            {/* Header row: avatar + name/team + total */}
            <div className="flex items-center gap-6 pt-1 pl-10">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div
                  className="h-[80px] w-[80px] rounded-full flex items-center justify-center text-2xl font-black select-none transition-all duration-500 group-hover:scale-105 overflow-hidden"
                  style={{ background: p.bg, border: `2px solid ${p.border}`, color: p.text, boxShadow: `0 0 28px ${p.glow}` }}
                >
                  {avatarUrl && !avatarError ? (
                    <img src={avatarUrl} alt={name} className="h-full w-full object-cover" referrerPolicy="no-referrer" loading="lazy" onError={() => setAvatarError(true)} />
                  ) : initials}
                </div>
                <div
                  className="absolute inset-[-3px] rounded-full border-2 opacity-0 group-hover:opacity-100 transition-all duration-500 animate-pulse"
                  style={{ borderColor: p.border, boxShadow: `0 0 18px ${p.glow}` }}
                />
              </div>

              {/* Name + team + manager */}
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <p className="text-2xl font-black text-foreground leading-tight tracking-tight truncate">{name}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {teamName && (
                    <span
                      className="inline-flex items-center rounded-full px-3 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
                      style={{ background: p.bg, border: `1px solid ${p.border}`, color: p.text }}
                    >
                      {teamName}
                    </span>
                  )}
                  {managerName && (
                    <span className="text-[11px] text-muted-foreground/60">· {managerName}</span>
                  )}
                </div>
              </div>

              {/* Total atingido */}
              <div className="text-right shrink-0 transition-all duration-300 group-hover:brightness-110">
                <p className="text-[8px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: "rgba(113,75,103,0.55)" }}>
                  Total Atingido
                </p>
                <p className="text-3xl font-black tabular-nums leading-none" style={{ color: "#714B67" }}>
                  {fmt(total)}
                </p>
                {typeof totalPct === "number" && totalTarget && totalTarget > 0 && (
                  <p className={cn("text-sm font-bold tabular-nums mt-1", pctColor(totalPct))}>
                    {fmtPct(totalPct)}{totalPct >= 100 && " 🎉"}
                  </p>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${p.border}, transparent)` }} />

            {/* MRR + NRR breakdown (horizontal, larger) */}
            <div className="flex items-stretch gap-0 flex-1">
              {/* MRR */}
              <div className="flex flex-col items-center gap-3 flex-1 px-4 py-2">
                <span
                  className="inline-flex items-center justify-center rounded-full text-[10px] font-black tracking-wider uppercase w-[52px] h-[22px]"
                  style={{ background: "rgba(113,75,103,0.32)", border: `1.5px solid ${MRR_BADGE.border}`, color: MRR_BADGE.text, boxShadow: "0 0 8px rgba(113,75,103,0.20)" }}
                >
                  MRR
                </span>
                <span className="text-2xl font-extrabold tabular-nums text-center leading-tight text-foreground">
                  {fmt(mrrAchieved)}
                </span>
                {mrrTarget > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">de {fmt(mrrTarget)}</span>
                )}
                <span className={cn("text-lg font-black tabular-nums", pctColor(mrrPct))}>
                  {fmtPct(mrrPct)}{mrrPct >= 100 && " 🎉"}
                </span>
              </div>

              {/* Divider */}
              <div className="relative self-stretch mx-2 shrink-0" style={{ width: "1px" }}>
                <div className="absolute inset-0 rounded-full" style={{ background: "rgba(113,75,103,0.30)" }} />
                <div className="absolute inset-0 rounded-full blur-[3px]" style={{ background: "rgba(113,75,103,0.18)", transform: "scaleX(4)" }} />
              </div>

              {/* NRR */}
              <div className="flex flex-col items-center gap-3 flex-1 px-4 py-2">
                <span
                  className="inline-flex items-center justify-center rounded-full text-[10px] font-black tracking-wider uppercase w-[52px] h-[22px]"
                  style={{ background: "rgba(1,126,132,0.28)", border: `1.5px solid ${NRR_BADGE.border}`, color: NRR_BADGE.text, boxShadow: "0 0 8px rgba(1,126,132,0.18)" }}
                >
                  NRR
                </span>
                <span className="text-2xl font-extrabold tabular-nums text-center leading-tight text-foreground">
                  {fmt(nrrAchieved)}
                </span>
                {nrrTarget > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">de {fmt(nrrTarget)}</span>
                )}
                <span className={cn("text-lg font-black tabular-nums", pctColor(nrrPct))}>
                  {fmtPct(nrrPct)}{nrrPct >= 100 && " 🎉"}
                </span>
              </div>
            </div>
          </>
        ) : (
          /* ── Compact layout: original vertical ── */
          <>
            {/* Avatar */}
            <div className="flex flex-col items-center gap-2.5 pt-2">
              <div className="relative">
                <div
                  className="h-[68px] w-[68px] rounded-full flex items-center justify-center text-xl font-black select-none transition-all duration-500 group-hover:scale-105 overflow-hidden"
                  style={{ background: p.bg, border: `2px solid ${p.border}`, color: p.text, boxShadow: `0 0 22px ${p.glow}` }}
                >
                  {avatarUrl && !avatarError ? (
                    <img src={avatarUrl} alt={name} className="h-full w-full object-cover" referrerPolicy="no-referrer" loading="lazy" onError={() => setAvatarError(true)} />
                  ) : initials}
                </div>
                <div
                  className="absolute inset-[-3px] rounded-full border-2 opacity-0 group-hover:opacity-100 transition-all duration-500 animate-pulse"
                  style={{ borderColor: p.border, boxShadow: `0 0 18px ${p.glow}` }}
                />
              </div>

              {/* Nome + time */}
              <div className="text-center transition-transform duration-300 group-hover:-translate-y-0.5 flex flex-col items-center gap-1.5">
                <p className="text-[15px] font-black text-foreground leading-tight tracking-tight">{name}</p>
                {teamName && (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase"
                    style={{ background: p.bg, border: `1px solid ${p.border}`, color: p.text }}
                  >
                    {teamName}
                  </span>
                )}
              </div>
            </div>

            {/* Total atingido */}
            <div className="text-center transition-all duration-300 group-hover:brightness-110 py-0.5">
              <p className="text-[8px] uppercase tracking-widest font-semibold mb-1" style={{ color: "rgba(113,75,103,0.55)" }}>
                Total Atingido
              </p>
              <p className="text-[16px] font-black tabular-nums leading-none" style={{ color: "#714B67" }}>
                {fmt(total)}
              </p>
            </div>

            {/* Breakdown MRR + NRR */}
            <div className="flex items-stretch gap-0">
              {/* MRR */}
              <div className="flex flex-col items-center gap-2 flex-1 px-2 py-1">
                <span
                  className="inline-flex items-center justify-center rounded-full text-[9px] font-black tracking-wider uppercase w-[42px] h-[19px]"
                  style={{ background: "rgba(113,75,103,0.32)", border: `1.5px solid ${MRR_BADGE.border}`, color: MRR_BADGE.text, boxShadow: "0 0 8px rgba(113,75,103,0.20)" }}
                >
                  MRR
                </span>
                <span className="text-[12px] font-extrabold tabular-nums text-center leading-tight text-foreground">
                  {fmt(mrrAchieved)}
                </span>
                <span className={cn("text-[12px] font-black tabular-nums", pctColor(mrrPct))}>
                  {fmtPct(mrrPct)}{mrrPct >= 100 && " 🎉"}
                </span>
              </div>

              {/* Divider */}
              <div className="relative self-stretch mx-1.5 shrink-0" style={{ width: "1px" }}>
                <div className="absolute inset-0 rounded-full" style={{ background: "rgba(113,75,103,0.30)" }} />
                <div className="absolute inset-0 rounded-full blur-[3px]" style={{ background: "rgba(113,75,103,0.18)", transform: "scaleX(4)" }} />
              </div>

              {/* NRR */}
              <div className="flex flex-col items-center gap-2 flex-1 px-2 py-1">
                <span
                  className="inline-flex items-center justify-center rounded-full text-[9px] font-black tracking-wider uppercase w-[42px] h-[19px]"
                  style={{ background: "rgba(1,126,132,0.28)", border: `1.5px solid ${NRR_BADGE.border}`, color: NRR_BADGE.text, boxShadow: "0 0 8px rgba(1,126,132,0.18)" }}
                >
                  NRR
                </span>
                <span className="text-[12px] font-extrabold tabular-nums text-center leading-tight text-foreground">
                  {fmt(nrrAchieved)}
                </span>
                <span className={cn("text-[12px] font-black tabular-nums", pctColor(nrrPct))}>
                  {fmtPct(nrrPct)}{nrrPct >= 100 && " 🎉"}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Borda animada no hover */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ border: `1px solid ${p.border}`, boxShadow: `inset 0 0 24px ${p.glow}` }}
        />
      </div>
    </>
  )
}
