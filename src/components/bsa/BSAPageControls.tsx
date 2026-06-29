import { Fragment, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { User, Users, Building2, Moon, Sun, RefreshCw, TrendingUp, UserCheck, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useBSAContext, type BSAViewMode } from "@/contexts/BSAContext";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DummyDataBadge } from "@/components/DummyDataBadge";

// ── Liquid glass tokens (espelho de DirectSalesPageControls) ──────────────────

const pillBase = [
  "relative inline-flex items-center",
  "rounded-xl",
  "bg-white/[0.12] dark:bg-white/[0.05]",
  "backdrop-blur-xl",
  "border border-white/35 dark:border-white/[0.09]",
  "shadow-[0_1px_10px_-3px_rgba(0,0,0,0.07),inset_0_1px_0_rgba(255,255,255,0.48)]",
  "dark:shadow-[0_1px_8px_-3px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)]",
].join(" ");

const singleBtn = [
  pillBase,
  "h-7 w-7 justify-center",
  "cursor-pointer transition-all duration-150 active:scale-95",
  "text-foreground/55 hover:text-foreground",
  "hover:bg-white/20 dark:hover:bg-white/[0.08]",
].join(" ");

const groupBtn = [
  "inline-flex items-center justify-center h-[22px] w-[22px] rounded-lg",
  "cursor-pointer transition-all duration-150 active:scale-95",
  "text-foreground/50 hover:text-foreground",
  "hover:bg-white/20 dark:hover:bg-white/[0.08]",
].join(" ");

const groupBtnActive = [
  "bg-white/32 dark:bg-white/[0.12] text-foreground",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.50)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
].join(" ");

const divider = "w-px h-3 bg-white/30 dark:bg-white/[0.08] shrink-0 mx-0.5";

function PillShine() {
  return (
    <span className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-white/55 to-transparent dark:via-white/[0.10]" />
  );
}

// ── View options ──────────────────────────────────────────────────────────────

const VIEW_OPTIONS: { mode: BSAViewMode; icon: typeof User; label: string }[] = [
  { mode: "analyst",     icon: User,      label: "Analista" },
  { mode: "team_leader", icon: Users,     label: "Time"     },
  { mode: "manager",     icon: Building2, label: "Gerente"  },
];

// ── Sync (replicado de DirectSalesPageControls — placeholder para BSA) ────────

type SyncTarget = "bsa" | "employees";
type SyncStep   = "closed" | "menu" | "key";

const SYNC_OPTIONS: { id: SyncTarget; icon: typeof User; label: string; sublabel: string }[] = [
  { id: "bsa",       icon: TrendingUp, label: "BSA",       sublabel: "billable_report" },
  { id: "employees", icon: UserCheck,  label: "Employees", sublabel: "res_users"       },
];


// ── Componente principal ──────────────────────────────────────────────────────

export function BSAPageControls() {
  const { theme, setTheme } = useTheme();
  const { viewMode, setViewMode, canSwitchView, analysts, loadingAnalysts, selectedAnalyst, setSelectedAnalyst, teamLeaders, selectedTeamLeader, setSelectedTeamLeader } = useBSAContext();
  const isDark = theme === "dark";

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const [syncStep,   setSyncStep]   = useState<SyncStep>("closed");
  const [syncTarget, setSyncTarget] = useState<SyncTarget | null>(null);
  const [apiKey,     setApiKey]     = useState("");
  const [syncing,    setSyncing]    = useState(false);
  const apiKeyRef = useRef<HTMLInputElement>(null);
  const syncRef   = useRef<HTMLDivElement>(null);

  const closeSync = () => { setSyncStep("closed"); setSyncTarget(null); setApiKey(""); };

  useEffect(() => {
    if (syncStep === "closed") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSync(); };
    const onMouseDown = (e: MouseEvent) => {
      if (syncRef.current && !syncRef.current.contains(e.target as Node)) closeSync();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [syncStep]);

  const selectTarget = (id: SyncTarget) => {
    setSyncTarget(id);
    setSyncStep("key");
    setTimeout(() => apiKeyRef.current?.focus(), 50);
  };

  const handleConfirm = () => {
    toast.error("Sync indisponível na versão demo.", { duration: 4000 });
    closeSync();
  };

  const selectedOpt = SYNC_OPTIONS.find(o => o.id === syncTarget);

  return (
    <div className="flex items-center gap-1.5">

      {/* ── Demo badge ── */}
      <DummyDataBadge />

      {/* ── 1. Info ── */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button className={singleBtn}>
            <PillShine />
            <span className="text-[15px] leading-none" style={{ fontFamily: "'Dancing Script', cursive", fontWeight: 700 }}>i</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6} className="text-[10px] px-2 py-0.5 rounded-lg font-medium">
          Informações
        </TooltipContent>
      </Tooltip>

      {/* ── 2. Theme ── */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={() => setTheme(isDark ? "light" : "dark")} className={singleBtn}>
            <PillShine />
            {isDark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6} className="text-[10px] px-2 py-0.5 rounded-lg font-medium">
          {isDark ? "Dark" : "Light"}
        </TooltipContent>
      </Tooltip>

      {/* ── 3. Sync ── (placeholder — replicado de DirectSales) */}
      <div ref={syncRef} className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={syncStep === "closed" ? () => setSyncStep("menu") : closeSync}
              className={cn(singleBtn, syncStep !== "closed" && "text-foreground bg-white/20 dark:bg-white/[0.08]")}
            >
              <PillShine />
              <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
            </button>
          </TooltipTrigger>
          {syncStep === "closed" && (
            <TooltipContent side="bottom" sideOffset={6} className="text-[10px] px-2 py-0.5 rounded-lg font-medium">
              Sync de dados
            </TooltipContent>
          )}
        </Tooltip>

        {syncStep !== "closed" && (
          <>
            <div
              className={cn(
                pillBase,
                "absolute top-full mt-1.5 z-[200]",
                "flex flex-col py-1 px-1 w-40",
                "animate-in fade-in-0 slide-in-from-top-1 duration-150",
              )}
              style={{ left: "50%", transform: "translateX(-50%)" }}
            >
              <PillShine />
              {SYNC_OPTIONS.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => selectTarget(id)}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[10px] font-medium",
                    "transition-all duration-100",
                    "text-foreground/60 hover:text-foreground hover:bg-white/15 dark:hover:bg-white/[0.07]",
                    syncTarget === id && "text-foreground bg-white/20 dark:bg-white/[0.10]",
                  )}
                >
                  <Icon className="h-2.5 w-2.5 shrink-0" />
                  <span className="whitespace-nowrap">{label}</span>
                </button>
              ))}
            </div>

            {syncStep === "key" && selectedOpt && (() => {
              const SelectedIcon = selectedOpt.icon;
              const selectedIndex = SYNC_OPTIONS.findIndex(o => o.id === syncTarget);
              return (
                <div
                  className={cn(
                    pillBase,
                    "absolute top-full mt-1.5 z-[200]",
                    "flex items-center gap-1.5 px-2.5 h-8",
                    "animate-in fade-in-0 slide-in-from-left-1 duration-150",
                  )}
                  style={{ left: "calc(50% + 86px)", width: 210, transform: `translateY(${selectedIndex * 28}px)` }}
                >
                  <PillShine />
                  <SelectedIcon className="h-3 w-3 shrink-0 opacity-35" />
                  <input
                    ref={apiKeyRef}
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConfirm();
                      if (e.key === "Escape") closeSync();
                    }}
                    placeholder={`API key · ${selectedOpt.label}…`}
                    className="flex-1 bg-transparent outline-none border-none text-[10px] font-medium min-w-0 placeholder:opacity-35"
                    style={{ color: isDark ? "rgba(255,255,255,0.80)" : "rgba(0,0,0,0.65)" }}
                  />
                  <button
                    onClick={handleConfirm}
                    disabled={!apiKey.trim() || syncing}
                    className={cn(
                      groupBtn, "shrink-0",
                      (!apiKey.trim() || syncing) ? "opacity-20 cursor-not-allowed" : "opacity-55 hover:opacity-100",
                    )}
                  >
                    {syncing
                      ? <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                      : <Check className="h-2.5 w-2.5" />}
                  </button>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* ── 4. View switch (manager/admin only) ── */}
      {canSwitchView && (
        <div className={cn(pillBase, "h-7 gap-0 px-1")}>
          <PillShine />
          {VIEW_OPTIONS.map(({ mode, icon: Icon, label }, i) => (
            <Fragment key={mode}>
              {i > 0 && <span className={divider} />}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode(mode)}
                    className={cn(groupBtn, viewMode === mode && groupBtnActive)}
                  >
                    <Icon className="h-2.5 w-2.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} align="center" className="text-[10px] px-2 py-0.5 rounded-lg font-medium">
                  {label}
                </TooltipContent>
              </Tooltip>
            </Fragment>
          ))}
        </div>
      )}

      {/* ── 5a. Analyst selector (analyst view, admin only) ── */}
      {canSwitchView && viewMode === "analyst" && (loadingAnalysts || analysts.length > 0) && (
        <Select
          value={selectedAnalyst ?? ""}
          onValueChange={(v) => setSelectedAnalyst(v || null)}
          disabled={loadingAnalysts}
        >
          <SelectTrigger className="w-[170px] h-7 text-[10px] glass-button border-0 gap-1.5 shrink-0">
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
            <SelectValue placeholder={loadingAnalysts ? "Carregando..." : "Selecionar"} />
          </SelectTrigger>
          <SelectContent>
            {analysts.map((name) => (
              <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* ── 5b. Team leader selector (team_leader view, admin only) ── */}
      {canSwitchView && viewMode === "team_leader" && (loadingAnalysts || teamLeaders.length > 0) && (
        <Select
          value={selectedTeamLeader ?? ""}
          onValueChange={(v) => setSelectedTeamLeader(v || null)}
          disabled={loadingAnalysts}
        >
          <SelectTrigger className="w-[170px] h-7 text-[10px] glass-button border-0 gap-1.5 shrink-0">
            <Users className="h-3 w-3 text-muted-foreground shrink-0" />
            <SelectValue placeholder={loadingAnalysts ? "Carregando..." : "Selecionar time"} />
          </SelectTrigger>
          <SelectContent>
            {teamLeaders.map((name) => (
              <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* ── 6. Datetime ── */}
      <div className="flex flex-col items-start gap-0.5 ml-[5px]">
        <span className="text-[10px] text-foreground/40 tabular-nums">
          {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          {" – "}
          {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>

    </div>
  );
}
