import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsDark } from "@/hooks/useIsDark";

interface BSAKpiCardProps {
  title: string;
  color: string;
  icon: React.ElementType;
  value?: string;      // "142h" — placeholder quando omitido
  valueNode?: React.ReactNode; // override de value com JSX customizado
  meta?: string;       // "Meta: 160h"
  pct?: number;        // 0-200
  pctLabel?: string;   // prefixo do badge: "Meta Billable" → "Meta Billable: 87%"
  pctIcon?: React.ElementType; // ícone dentro do badge (independente do ícone do card)
  prevLabel?: string;  // "↑ 12.4%" ou valor direto "142h"
  prevSublabel?: React.ReactNode; // override do label "vs mês anterior"
  prevBadge?: React.ReactNode;    // conteúdo abaixo do value da coluna esquerda
  valueBadge?: React.ReactNode;   // badges abaixo do valor principal (saldo devedor, etc)
  nextLabel?: string;  // "sem dados"
  hideBottomGrid?: boolean;       // oculta toda a seção de sublabels inferior
  infoContent?: React.ReactNode; // conteúdo do overlay info (ícone (i) ao lado do valor)
}

export function BSAKpiCard({ title, color, icon: Icon, value, valueNode, meta, pct, pctLabel, pctIcon: PctIcon, prevLabel, prevSublabel, prevBadge, valueBadge, nextLabel, hideBottomGrid, infoContent }: BSAKpiCardProps) {
  const isDark = useIsDark();
  const [showInfo, setShowInfo] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showInfo) return;
    function handleClick(e: MouseEvent) {
      if (
        overlayRef.current && !overlayRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setShowInfo(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showInfo]);

  const bg     = isDark ? "rgba(255,255,255,0.030)" : "rgba(255,255,255,0.58)";
  const border = isDark ? "1px solid rgba(255,255,255,0.09)" : "1px solid rgba(0,0,0,0.06)";
  const shadow = isDark
    ? "0 2px 16px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.06) inset"
    : "0 2px 14px rgba(0,0,0,0.05), 0 1px 0 rgba(255,255,255,0.80) inset";

  const numColor = isDark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.82)";
  const subColor = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.40)";

  const hasData = value !== undefined;
  const goalMet = hasData && pct !== undefined && pct >= 100;

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-2"
      style={{ background: bg, backdropFilter: "blur(22px) saturate(145%)", WebkitBackdropFilter: "blur(22px) saturate(145%)", border, boxShadow: shadow, position: "relative", zIndex: showInfo ? 50 : undefined }}
    >
      {/* Título */}
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" style={{ color }} />
        <span className="text-[10px] font-semibold text-muted-foreground/55 tracking-wide uppercase">{title}</span>
      </div>

      {/* Valor principal */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <p className="text-[36px] font-extrabold tabular-nums text-foreground leading-none">
            {valueNode ?? (hasData ? value : <span className="text-muted-foreground/30">—</span>)}
          </p>
        </div>

        {valueBadge}

        {hasData && meta && (
          <span className="text-[12px] text-muted-foreground/65 font-bold">{meta}</span>
        )}

        {hasData && pct !== undefined && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
              style={goalMet
                ? { background: "rgba(34,197,94,0.13)", border: "1px solid rgba(34,197,94,0.32)", color: "#22c55e" }
                : { background: "rgba(228,169,0,0.13)", border: "1px solid rgba(228,169,0,0.32)", color: "#E4A900" }}
            >
              {pctLabel && PctIcon && <PctIcon className="h-2.5 w-2.5 shrink-0" />}
              {pctLabel ? `${pctLabel}: ` : ""}{goalMet ? "🎉 " : ""}{pct.toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* Ver informações — rodapé */}
      {infoContent && (
        <div className="relative mt-1">
          <button
            ref={triggerRef}
            onClick={() => setShowInfo(v => !v)}
            className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg transition-colors"
            style={{
              background: showInfo
                ? (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)")
                : "transparent",
              border: "none",
              cursor: "pointer",
              color: showInfo ? (isDark ? "#c4a3d4" : "#714B67") : subColor,
              transition: "color 0.15s, background 0.15s",
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Ver informações
            </span>
            <ChevronDown
              size={12}
              strokeWidth={2.5}
              style={{ transition: "transform 0.2s", transform: showInfo ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>

          {showInfo && (
            <div
              ref={overlayRef}
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                zIndex: 9999,
                background: isDark ? "rgba(14,15,24,0.97)" : "rgba(255,255,255,0.99)",
                backdropFilter: "blur(24px) saturate(160%)",
                WebkitBackdropFilter: "blur(24px) saturate(160%)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)"}`,
                borderRadius: 14, padding: "16px 18px",
                boxShadow: "0 16px 48px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.12)",
                color: numColor,
              }}
            >
              {infoContent}
            </div>
          )}
        </div>
      )}

      {/* VS mês anterior / seguinte */}
      {!hideBottomGrid && <div className="grid grid-cols-[1fr_1px_1fr] gap-0 pt-[5px] border-t border-border/15">
        <div className="flex flex-col gap-0.5 pr-3">
          <span className="text-[8px] uppercase tracking-wider text-muted-foreground/35 font-semibold">{prevSublabel ?? "vs mês anterior"}</span>
          {prevLabel ? (
            <span className={cn(
              "text-[15px] font-bold tabular-nums",
              prevLabel.startsWith("↑") ? "text-emerald-500" : prevLabel.startsWith("↓") ? "text-red-400" : "text-foreground/70"
            )}>
              {prevLabel}
            </span>
          ) : (
            <span className="text-[12px] text-muted-foreground/35 italic">sem dados</span>
          )}
          {prevBadge}
        </div>
        <div className="bg-white/8 rounded-full" />
        <div className="flex flex-col gap-0.5 pl-3">
          <span className="text-[8px] uppercase tracking-wider text-muted-foreground/35 font-semibold">vs mês seguinte</span>
          {nextLabel ? (
            <span className={cn("text-[15px] font-bold tabular-nums", nextLabel.startsWith("↑") ? "text-emerald-500" : "text-red-400")}>
              {nextLabel}
            </span>
          ) : (
            <span className="text-[12px] text-muted-foreground/35 italic">sem dados</span>
          )}
        </div>
      </div>}

    </div>
  );
}
