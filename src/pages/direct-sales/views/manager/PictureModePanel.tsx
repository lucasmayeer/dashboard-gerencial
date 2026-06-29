import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Camera, X } from "lucide-react";
import lucasMayerImg from "@/assets/lucas_mayer.png";
import rodrigoMarbaImg from "@/assets/rodrigo_marba.png";
import headingPicmodeLight from "@/assets/heading-picmode_light.svg";
import headingPicmodeDark from "@/assets/heading-picmode_dark.svg";
import footerAppsImg from "@/assets/footer_apps.svg";
import { formatMonthLabel } from "@/lib/directSalesUtils";
import { sellerRankingScore, type SellerMetrics } from "@/lib/desempenhoUtils";
import {
  useIsDark,
  TOP_PERFORMANCE_SELLERS,
  TopPerformanceBadge,
  GoatBadge,
  RankBadge,
  TopRankStreakBadge,
  StreakBadge,
  TeamBadgeDsm,
} from "../DesempenhoShared";


export function PictureModePanel({
  onClose,
  seller,
  selectedMonth,
  sellerRank,
  sellers,
  goatRank,
  topRankStreak,
  mrrStreak,
  nrrStreak,
  isTeamLeader = false,
  leaderName,
  teamName,
  teamMrrPct,
  teamNrrPct,
  teamTetragrams = [],
  teamColor,
}: {
  onClose: () => void;
  seller: SellerMetrics | null;
  selectedMonth: string;
  sellerRank: number | null;
  sellers: SellerMetrics[];
  goatRank: number | null;
  topRankStreak: { top1: number; top2: number; top3: number } | null;
  mrrStreak: number;
  nrrStreak: number;
  isTeamLeader?: boolean;
  leaderName?: string;
  teamName?: string | null;
  teamMrrPct?: number;
  teamNrrPct?: number;
  teamTetragrams?: string[];
  teamColor?: { bg: string; border: string; text: string } | null;
}) {
  const isDark = useIsDark();
  const [photo, setPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const teamRank = useMemo(() => {
    if (!seller) return null;
    const members = sellers
      .filter((s) => s.managerName === seller.managerName)
      .sort((a, b) => {
        const scoreOf = (s: SellerMetrics) => sellerRankingScore(
          s.mrr.target > 0 ? (s.mrr.achieved / s.mrr.target) * 100 : 0,
          s.nrr.target > 0 ? (s.nrr.achieved / s.nrr.target) * 100 : 0,
        );
        return scoreOf(b) - scoreOf(a);
      });
    const idx = members.findIndex((s) => s.userId === seller.userId);
    return idx >= 0 ? idx + 1 : null;
  }, [seller, sellers]);

  const mrrPct = isTeamLeader
    ? Math.round(teamMrrPct ?? 0)
    : (seller && seller.mrr.target > 0 ? Math.round((seller.mrr.achieved / seller.mrr.target) * 100) : 0);
  const nrrPct = isTeamLeader
    ? Math.round(teamNrrPct ?? 0)
    : (seller && seller.nrr.target > 0 ? Math.round((seller.nrr.achieved / seller.nrr.target) * 100) : 0);

  const displayName = isTeamLeader ? (leaderName || "—") : (seller ? seller.name : "—");
  const monthLabel = selectedMonth ? formatMonthLabel(selectedMonth) : "—";

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(URL.createObjectURL(file));
  };

  const CYAN = "#1BB6F9";
  const numColor = isDark ? "#FFFFFF" : "#714B67";
  const subColor = isDark ? "rgba(255,255,255,0.40)" : "#8F8F8F";
  const cardBg = isDark ? "#0C0D14" : "#FFFFFF";
  const vignetteColor = cardBg;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        backdropFilter: isDark ? "blur(8px) saturate(1.2)" : "blur(4px) saturate(1.1)",
        WebkitBackdropFilter: isDark ? "blur(8px) saturate(1.2)" : "blur(4px) saturate(1.1)",
        background: "radial-gradient(ellipse at center, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.76) 100%)",
      }}
      onClick={onClose}
    >
      <div
        className="relative flex overflow-hidden"
        style={{
          width: "min(90vw, calc(86vh * 16 / 9))",
          aspectRatio: "16 / 9",
          background: cardBg,
          boxShadow: "0 32px 96px rgba(0,0,0,0.55), 0 8px 32px rgba(0,0,0,0.35)",
          fontFamily: "'Inter', sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 h-6 w-6 flex items-center justify-center rounded-full opacity-30 hover:opacity-70 transition-opacity"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Coluna esquerda: foto */}
        <div className="relative shrink-0 overflow-hidden" style={{ width: "38%" }}>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          <div className="w-full h-full cursor-pointer relative overflow-hidden group" onClick={() => fileInputRef.current?.click()}>
            {photo ? (
              <>
                <img src={photo} alt="Foto" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-200 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center gap-1.5">
                    <Camera className="h-4 w-4 text-white drop-shadow" />
                    <span className="text-[10px] text-white/80 font-medium">Trocar</span>
                  </div>
                </div>
              </>
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center gap-3 p-6"
                style={{ background: isDark ? "hsl(240,18%,18%)" : "#EBEBEB" }}
              >
                <Camera className="h-8 w-8 opacity-20" />
                <span className="text-[11px] text-center leading-snug opacity-40">
                  Clique para adicionar sua foto
                </span>
              </div>
            )}
            <div
              className={`pointer-events-none absolute inset-y-0 right-0 ${isDark ? "w-[60%]" : "w-[40%]"}`}
              style={{ background: `linear-gradient(to right, transparent, ${vignetteColor})` }}
            />
          </div>
        </div>

        {/* Coluna direita: conteúdo */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ padding: "3% 5% 2.5% 4%" }}>
          <div className="flex items-start justify-between gap-4 shrink-0">
            <img
              src={isDark ? headingPicmodeDark : headingPicmodeLight}
              alt="Your results"
              style={{ height: "clamp(60px, 7.5vw, 115px)", width: "auto", objectFit: "contain", objectPosition: "left top" }}
            />
            <div className="text-right shrink-0 leading-tight" style={{ paddingTop: "6px" }}>
              <div style={{ fontSize: "clamp(0.6rem, 1.1vw, 0.9rem)", color: isDark ? "rgba(255,255,255,0.45)" : "#8F8F8F", fontStyle: "italic" }}>
                No mês de
              </div>
              <div style={{ fontSize: "clamp(0.75rem, 1.4vw, 1.1rem)", color: numColor, fontWeight: 700, fontStyle: "italic" }}>
                {monthLabel}
              </div>
            </div>
          </div>

          <div style={{ marginTop: "clamp(8px, 1.5%, 16px)" }} className="shrink-0">
            <h1 style={{ fontSize: "clamp(1.3rem, 2.8vw, 2.4rem)", fontWeight: 700, color: numColor, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              {displayName}
            </h1>
            {isTeamLeader ? (
              <div className="flex flex-wrap items-center gap-2" style={{ marginTop: "5px" }}>
                <span style={{ fontSize: "clamp(0.75rem, 1.3vw, 1.05rem)", color: subColor }}>Com o time:</span>
                <TeamBadgeDsm teamName={teamName ?? seller?.teamName ?? null} />
                <span style={{ fontSize: "clamp(0.75rem, 1.3vw, 1.05rem)", color: subColor, opacity: 0.4 }}>|</span>
                <span style={{ fontSize: "clamp(0.75rem, 1.3vw, 1.05rem)", color: subColor }}>E funcionários:</span>
                {teamTetragrams.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full px-2 py-0.5 font-bold uppercase tracking-wide"
                    style={{
                      fontSize: "clamp(0.55rem, 0.9vw, 0.7rem)",
                      background: teamColor?.bg ?? "rgba(255,255,255,0.08)",
                      border: `1px solid ${teamColor?.border ?? "rgba(255,255,255,0.18)"}`,
                      color: teamColor?.text ?? (isDark ? "#ffffff" : "#333333"),
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1" style={{ marginTop: "5px" }}>
                {TOP_PERFORMANCE_SELLERS.includes(seller?.name ?? "") && <TopPerformanceBadge />}
                {goatRank !== null && goatRank <= 3 && <GoatBadge rank={goatRank as 1 | 2 | 3} />}
                {sellerRank !== null && sellerRank <= 3 && <RankBadge rank={sellerRank as 1 | 2 | 3} month={selectedMonth} />}
                {topRankStreak !== null && topRankStreak.top1 >= 2 && <TopRankStreakBadge rank={1} count={topRankStreak.top1} />}
                {topRankStreak !== null && topRankStreak.top2 >= 2 && <TopRankStreakBadge rank={2} count={topRankStreak.top2} />}
                {topRankStreak !== null && topRankStreak.top3 >= 2 && <TopRankStreakBadge rank={3} count={topRankStreak.top3} />}
                {mrrStreak >= 2 && <StreakBadge type="MRR" count={mrrStreak} />}
                {nrrStreak >= 2 && <StreakBadge type="NRR" count={nrrStreak} />}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 flex-1 min-h-0" style={{ marginTop: "clamp(6px, 1.2%, 14px)", columnGap: "6%" }}>
            {/* MRR */}
            <div className="flex flex-col justify-center gap-0">
              <span style={{ fontSize: "clamp(1rem, 2.2vw, 1.75rem)", color: CYAN, fontWeight: 800, lineHeight: 1.1 }}>{isTeamLeader ? "MRR do Time" : "De MRR"}</span>
              <div style={{ lineHeight: 0.85, marginTop: "2px" }}>
                <span style={{ fontSize: "clamp(3.2rem, 8.2vw, 6.8rem)", fontWeight: 900, color: numColor }}>{mrrPct}</span>
                <span style={{ fontSize: "clamp(1.6rem, 4.1vw, 3.4rem)", fontWeight: 900, color: numColor }}>%</span>
              </div>
              <span style={{ fontSize: "clamp(0.65rem, 1.15vw, 0.95rem)", color: subColor, marginTop: "3px", lineHeight: 1.3 }}>
                Receita Recorrente Mensal
              </span>
            </div>

            {/* NRR */}
            <div className="flex flex-col justify-center gap-0">
              <span style={{ fontSize: "clamp(1rem, 2.2vw, 1.75rem)", color: CYAN, fontWeight: 800, lineHeight: 1.1 }}>{isTeamLeader ? "NRR do Time" : "De NRR"}</span>
              <div style={{ lineHeight: 0.85, marginTop: "2px" }}>
                <span style={{ fontSize: "clamp(3.2rem, 8.2vw, 6.8rem)", fontWeight: 900, color: numColor }}>{nrrPct}</span>
                <span style={{ fontSize: "clamp(1.6rem, 4.1vw, 3.4rem)", fontWeight: 900, color: numColor }}>%</span>
              </div>
              <span style={{ fontSize: "clamp(0.65rem, 1.15vw, 0.95rem)", color: subColor, marginTop: "3px", lineHeight: 1.3 }}>
                Taxa de Retenção de Receita Líquida
              </span>
            </div>

            {/* Rank time — apenas na view de employee */}
            {!isTeamLeader && (
              <div className="flex flex-col justify-center gap-0">
                <span style={{ fontSize: "clamp(1rem, 2.2vw, 1.75rem)", color: CYAN, fontWeight: 800, lineHeight: 1.1 }}>Eu fui Top</span>
                <div style={{ lineHeight: 0.85, marginTop: "2px" }}>
                  <span style={{ fontSize: "clamp(3.2rem, 8.2vw, 6.8rem)", fontWeight: 900, color: numColor }}>#{teamRank ?? "—"}</span>
                </div>
                <div className="flex items-center gap-1.5" style={{ marginTop: "5px" }}>
                  <span style={{ fontSize: "clamp(0.55rem, 1vw, 0.8rem)", color: subColor }}>Do time</span>
                  <TeamBadgeDsm teamName={seller?.teamName ?? null} />
                </div>
              </div>
            )}

            {/* Rank empresa */}
            <div className="flex flex-col justify-center gap-0">
              <span style={{ fontSize: "clamp(1rem, 2.2vw, 1.75rem)", color: CYAN, fontWeight: 800, lineHeight: 1.1 }}>{isTeamLeader ? "Meu time foi Top" : "Eu fui Top"}</span>
              <div style={{ lineHeight: 0.85, marginTop: "2px" }}>
                <span style={{ fontSize: "clamp(3.2rem, 8.2vw, 6.8rem)", fontWeight: 900, color: numColor }}>#{sellerRank ?? "—"}</span>
              </div>
              <div className="flex items-center gap-1.5" style={{ marginTop: "5px" }}>
                <span style={{ fontSize: "clamp(0.55rem, 1vw, 0.8rem)", color: subColor }}>Do departamento de vendas da</span>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0"
                  style={{
                    background: "linear-gradient(90deg, rgba(228,169,0,0.18) 0%, rgba(113,75,103,0.18) 100%)",
                    border: "1px solid rgba(228,169,0,0.40)",
                    color: "#E4A900",
                    fontSize: "clamp(0.5rem, 0.9vw, 0.65rem)",
                  }}
                >
                  Dashboard
                </span>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 shrink-0" style={{ marginTop: "clamp(8px, 1.8%, 18px)" }}>
            <div className="flex flex-col items-start gap-1 shrink-0">
              <span style={{ fontSize: "clamp(0.85rem, 1.7vw, 1.35rem)", fontWeight: 800, color: numColor, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
                #DashboardGerencial
              </span>
              <img src={footerAppsImg} alt="apps" style={{ height: "clamp(20px, 2.8vw, 38px)", width: "auto", flexShrink: 0, maxWidth: "100%", opacity: 0.75 }} />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span style={{ fontSize: "clamp(0.42rem, 0.65vw, 0.55rem)", color: isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)", fontWeight: 500, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                Criado por:
              </span>
              <a href="https://www.linkedin.com/in/lucasmayer00" target="_blank" rel="noopener noreferrer" className="no-underline shrink-0">
                <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-full border border-white/[0.08] transition-[opacity,transform] duration-150 hover:opacity-75 hover:scale-[1.04]" style={{ background: "rgba(228,110,120,0.16)" }}>
                  <img src={lucasMayerImg} alt="Lucas Mayer" className="h-3 w-3 rounded-full object-cover shrink-0" />
                  <span style={{ fontSize: "clamp(0.4rem, 0.62vw, 0.52rem)", fontWeight: 500, color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.42)", whiteSpace: "nowrap" }}>Lucas Mayer</span>
                </div>
              </a>
              <a href="https://www.linkedin.com/in/rodrigomarba" target="_blank" rel="noopener noreferrer" className="no-underline shrink-0">
                <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-full border border-white/[0.08] transition-[opacity,transform] duration-150 hover:opacity-75 hover:scale-[1.04]" style={{ background: "rgba(228,169,0,0.13)" }}>
                  <img src={rodrigoMarbaImg} alt="Rodrigo Marba" className="h-3 w-3 rounded-full object-cover shrink-0" />
                  <span style={{ fontSize: "clamp(0.4rem, 0.62vw, 0.52rem)", fontWeight: 500, color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.42)", whiteSpace: "nowrap" }}>Rodrigo Marba</span>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
