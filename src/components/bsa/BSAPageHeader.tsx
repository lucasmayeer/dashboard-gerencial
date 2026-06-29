import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBSAContext } from "@/contexts/BSAContext";
import { getInitials, extractTetragramFromName, stripTetragram } from "@/lib/desempenhoUtils";
import { hashTeamName, TEAM_NAME_FALLBACK_COLORS } from "@/lib/directSalesUtils";
import { VacationBadge, StreakBadge, RankBadge } from "@/pages/direct-sales/views/DesempenhoShared";

// ── Cor determinística por nome ───────────────────────────────────────────────
function nameColor(name: string) {
  return TEAM_NAME_FALLBACK_COLORS[hashTeamName(name)];
}

// ── Cores fixas — manager ─────────────────────────────────────────────────────
const MGR = { bg: "rgba(1,126,132,0.25)", ring: "rgba(1,126,132,0.40)", glow: "#017E84", text: "#2dd4bf" };

// ── Avatar ────────────────────────────────────────────────────────────────────
function HeadingAvatar({
  name, avatarUrl, bg, ring, glow, textColor,
}: {
  name: string; avatarUrl?: string | null;
  bg: string; ring: string; glow: string; textColor: string;
}) {
  return (
    <div className="relative shrink-0">
      <div className="absolute -inset-2 rounded-full blur-xl opacity-40 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 70%)` }} />
      <div className="relative w-[72px] h-[72px] rounded-full overflow-hidden"
        style={{ boxShadow: `0 0 0 2px ${ring}, 0 0 18px ${ring}` }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg font-bold"
            style={{ background: bg, color: textColor }}>
            {getInitials(name)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Badge genérico ────────────────────────────────────────────────────────────
function Chip({ label, c }: { label: string; c: { bg: string; border: string; text: string } }) {
  return (
    <span
      className="inline-flex self-start items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
    >
      {label}
    </span>
  );
}

// ── Manager ───────────────────────────────────────────────────────────────────
function ManagerHeading() {
  const { user } = useAuth();
  const { teamNames } = useBSAContext();

  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const avatarUrl: string | null = user?.user_metadata?.avatar_url ?? null;

  return (
    <div className="flex items-center gap-5">
      <HeadingAvatar name={name} avatarUrl={avatarUrl} bg={MGR.bg} ring={MGR.ring} glow={MGR.glow} textColor={MGR.text} />
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.18em] self-start">
          Painel do Gestor
        </span>
        <h1 className="leading-tight tracking-tight" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
          <span className="font-light text-muted-foreground/35 mr-1">Olá Gestor,</span>
          <span className="font-black animate-gradient-text">{name}</span>
        </h1>
        {teamNames.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <span className="text-xs italic text-muted-foreground/60">Overview Geral dos times:</span>
            {teamNames.map((t) => <Chip key={t} label={t} c={nameColor(t)} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Team Leader ───────────────────────────────────────────────────────────────
function TeamLeaderHeading() {
  const { selectedTeamLeader, analystsByManager, managerTeamName } = useBSAContext();

  const rawName = selectedTeamLeader ?? "";
  const name = stripTetragram(rawName);
  const teamName = rawName ? managerTeamName[rawName] : null;
  const c = (teamName ? nameColor(teamName) : name ? nameColor(name) : TEAM_NAME_FALLBACK_COLORS[0]);
  const analysts = rawName ? (analystsByManager[rawName] ?? []) : [];
  const tetras = analysts.map((a) => extractTetragramFromName(a)).filter(Boolean);

  if (!name) return (
    <div className="flex items-center gap-5">
      <div className="w-[72px] h-[72px] rounded-full animate-pulse bg-muted/30 shrink-0" />
      <div className="flex flex-col gap-2">
        <div className="h-2.5 w-24 rounded-full animate-pulse bg-muted/25" />
        <div className="h-8 w-56 rounded-lg animate-pulse bg-muted/25" />
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-5">
      <HeadingAvatar name={name} bg={c.bg} ring={c.border} glow={c.text} textColor={c.text} />
      <div className="flex flex-col gap-1.5">
        {teamName && <Chip label={teamName} c={c} />}
        <h1 className="leading-tight tracking-tight" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
          <span className="font-light text-muted-foreground/35 mr-1">Olá Líder,</span>
          <span className="font-black animate-gradient-text">{name}</span>
        </h1>
        {tetras.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <span className="text-xs italic text-muted-foreground/60">Overview Geral do time:</span>
            {tetras.map((t) => <Chip key={t} label={t} c={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Analyst ───────────────────────────────────────────────────────────────────
function RampUpBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0 bg-blue-500/15 text-blue-600 border border-blue-500/30">
      🚀 Ramp-up
    </span>
  );
}

function AnalystHeading({
  isOnFerias, isOnRampup, streakCount, analystRank,
}: {
  isOnFerias?: boolean;
  isOnRampup?: boolean;
  streakCount?: number;
  analystRank?: 1 | 2 | 3 | null;
}) {
  const { selectedAnalyst, analystTeamName, analystsByManager } = useBSAContext();

  const rawName = selectedAnalyst ?? "";
  const name = stripTetragram(rawName);
  const teamName = rawName ? analystTeamName[rawName] : null;

  const analystTL = useMemo(() => {
    if (!rawName) return null;
    for (const [tl, list] of Object.entries(analystsByManager)) {
      if (list.includes(rawName)) return tl;
    }
    return null;
  }, [rawName, analystsByManager]);

  const c = teamName ? nameColor(teamName) : analystTL ? nameColor(analystTL) : TEAM_NAME_FALLBACK_COLORS[0];

  if (!name) return (
    <div className="flex items-center gap-5">
      <div className="w-[72px] h-[72px] rounded-full animate-pulse bg-muted/30 shrink-0" />
      <div className="flex flex-col gap-2">
        <div className="h-2.5 w-20 rounded-full animate-pulse bg-muted/25" />
        <div className="h-8 w-56 rounded-lg animate-pulse bg-muted/25" />
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-5">
      <HeadingAvatar name={name} bg={c.bg} ring={c.border} glow={c.text} textColor={c.text} />
      <div className="flex flex-col gap-1.5">
        {teamName && <Chip label={teamName} c={c} />}
        <h1 className="leading-tight tracking-tight" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
          <span className="font-light text-muted-foreground/35 mr-1">Olá,</span>
          <span className="font-black animate-gradient-text">{name}</span>
        </h1>
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          {isOnFerias                        && <VacationBadge />}
          {isOnRampup                        && <RampUpBadge />}
          {!!streakCount && streakCount > 0  && <StreakBadge type="MRR" count={streakCount} label="Billable Streak" />}
          {analystRank != null               && <RankBadge rank={analystRank} labelOverride={analystRank === 1 ? "Billable King" : undefined} />}
        </div>
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
export function BSAPageHeader({
  isOnFerias, isOnRampup, streakCount, analystRank,
}: {
  isOnFerias?: boolean;
  isOnRampup?: boolean;
  streakCount?: number;
  analystRank?: 1 | 2 | 3 | null;
}) {
  const { viewMode } = useBSAContext();
  if (viewMode === "manager")     return <ManagerHeading />;
  if (viewMode === "team_leader") return <TeamLeaderHeading />;
  return (
    <AnalystHeading
      isOnFerias={isOnFerias}
      isOnRampup={isOnRampup}
      streakCount={streakCount}
      analystRank={analystRank}
    />
  );
}
