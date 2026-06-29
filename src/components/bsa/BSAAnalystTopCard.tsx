import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Crown, Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtPct, pctColor } from "@/lib/directSalesUtils";
import { getInitials } from "@/lib/desempenhoUtils";
import { fmtH } from "@/lib/bsaUtils";

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
} as const;

export type BSAAnalystTopCardProps = {
  rank: 1 | 2 | 3;
  name: string;
  teamName: string | null;
  billable: number;
  meta: number;
  pct: number;
  avatarUrl?: string | null;
  noConfetti?: boolean;
};

type Particle = {
  id: number;
  x: number;
  startY: number;
  size: number;
  delay: number;
  duration: number;
  rot: number;
  kind: "text" | "avatar";
  label: string;
};

const KEYFRAME_ID = "bsa-top-confetti-kf";
if (typeof document !== "undefined" && !document.getElementById(KEYFRAME_ID)) {
  const s = document.createElement("style");
  s.id = KEYFRAME_ID;
  s.textContent = `
    @keyframes bsaConfettiRise {
      0%   { opacity: 0;   transform: translateY(0)      translateX(0)      rotate(var(--rot)) scale(0.6); }
      6%   { opacity: 1; }
      30%  {              transform: translateY(-35vh)   translateX(14px)   rotate(calc(var(--rot) + 6deg))  scale(1.05); }
      60%  {              transform: translateY(-72vh)   translateX(-9px)   rotate(calc(var(--rot) + 14deg)) scale(0.9);  opacity: 0.9; }
      100% { opacity: 0;   transform: translateY(-125vh) translateX(5px)    rotate(calc(var(--rot) + 24deg)) scale(0.45); }
    }
  `;
  document.head.appendChild(s);
}

export function BSAAnalystTopCard({
  rank, name, teamName, billable, meta, pct, avatarUrl, noConfetti = false,
}: BSAAnalystTopCardProps) {
  const p = RANK_PALETTE[rank];
  const initials = getInitials(name);
  const isFirst = rank === 1;

  const [avatarError, setAvatarError] = useState(false);
  useEffect(() => { setAvatarError(false); }, [avatarUrl]);

  const [particles, setParticles] = useState<Particle[]>([]);
  const pidRef = useRef(0);

  const handleClick = useCallback(() => {
    if (noConfetti) return;
    const topLabel = `#TOP${rank}`;
    const textPool = [topLabel, topLabel, topLabel, "🔥", "🔥", "🎉"];
    const count = 56;

    const spawned: Particle[] = Array.from({ length: count }, (_, i) => {
      const isAvatar = i % 7 === 0;
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
      };
    });

    setParticles((prev) => [...prev, ...spawned]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((pt) => !spawned.find((s) => s.id === pt.id)));
    }, 5000);
  }, [rank, noConfetti, initials]);

  const confettiPortal = particles.length > 0 && createPortal(
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 9999 }}>
      {particles.map((pt) => {
        const baseStyle: React.CSSProperties = {
          left: `${pt.x}vw`,
          top: `${pt.startY}vh`,
          animationName: "bsaConfettiRise",
          animationDuration: `${pt.duration}ms`,
          animationDelay: `${pt.delay}ms`,
          animationTimingFunction: "cubic-bezier(0.15, 0.85, 0.45, 1)",
          animationFillMode: "forwards",
          // @ts-ignore
          "--rot": `${pt.rot}deg`,
        };

        if (pt.kind === "avatar") {
          const dim = pt.size;
          const showPhoto = !!avatarUrl && !avatarError;
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
          );
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
        );
      })}
    </div>,
    document.body,
  );

  return (
    <>
      {confettiPortal}

      <div
        onClick={handleClick}
        className={cn(
          "group relative overflow-hidden rounded-2xl cursor-pointer",
          "glass-card transition-all duration-500",
          "p-5 flex flex-col gap-4 hover:scale-[1.04] hover:-translate-y-1.5",
          !isFirst && "opacity-90",
          isFirst && "scale-[1.025]",
        )}
        style={{
          border: `1px solid ${p.border}`,
          boxShadow: `0 4px 32px ${p.glow}, 0 1px 0 rgba(255,255,255,0.05) inset`,
        }}
      >
        {/* Shine */}
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-2xl"
          style={{ background: `linear-gradient(90deg, transparent, ${p.shine}, transparent)` }}
        />

        {/* Badge de posição */}
        <div className="absolute top-3 left-3 flex flex-col items-center gap-0.5">
          <div
            className="inline-flex items-center justify-center rounded-full w-7 h-7"
            style={{ background: p.bg, border: `1px solid ${p.border}`, color: p.text }}
          >
            {rank === 1
              ? <Crown className="h-4 w-4" style={{ color: p.text }} />
              : <Medal className="h-4 w-4" style={{ color: p.text }} />}
          </div>
          <span
            className="text-[9px] font-black tracking-widest uppercase leading-none"
            style={{ color: p.text }}
          >
            #TOP{rank}
          </span>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center gap-2.5 pt-2">
          <div className="relative">
            <div
              className="h-[68px] w-[68px] rounded-full flex items-center justify-center text-xl font-black select-none transition-all duration-500 group-hover:scale-105 overflow-hidden"
              style={{ background: p.bg, border: `2px solid ${p.border}`, color: p.text, boxShadow: `0 0 22px ${p.glow}` }}
            >
              {avatarUrl && !avatarError ? (
                <img
                  src={avatarUrl}
                  alt={name}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  onError={() => setAvatarError(true)}
                />
              ) : initials}
            </div>
            <div
              className="absolute inset-[-3px] rounded-full border-2 opacity-0 group-hover:opacity-100 transition-all duration-500 animate-pulse"
              style={{ borderColor: p.border, boxShadow: `0 0 18px ${p.glow}` }}
            />
          </div>

          <div className="text-center flex flex-col items-center gap-1.5">
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

        {/* Horas faturadas */}
        <div className="text-center transition-all duration-300 group-hover:brightness-110 py-0.5">
          <p className="text-[8px] uppercase tracking-widest font-semibold mb-1 text-[#714B67] dark:text-white/60">
            Horas Faturadas
          </p>
          <p className="text-[22px] font-black tabular-nums leading-none text-[#714B67] dark:text-white">
            {fmtH(billable)}
          </p>
        </div>

        {/* Meta + % */}
        <div className="flex items-center justify-center gap-4 tabular-nums">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground/45 font-medium">Meta</span>
            <span className="text-[11px] text-muted-foreground">{fmtH(meta)}</span>
          </div>
          <div
            className="h-6 w-px"
            style={{ background: `linear-gradient(to bottom, transparent, ${p.border}, transparent)` }}
          />
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground/45 font-medium">%</span>
            <span className={cn("text-[13px] font-black", pctColor(pct))}>
              {fmtPct(pct)}{pct >= 100 && " 🎉"}
            </span>
          </div>
        </div>

        {/* Borda hover */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ border: `1px solid ${p.border}`, boxShadow: `inset 0 0 24px ${p.glow}` }}
        />
      </div>
    </>
  );
}
