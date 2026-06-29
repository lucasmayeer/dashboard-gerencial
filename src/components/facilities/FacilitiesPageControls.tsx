import { useState, useRef, useEffect } from "react";
import { Sun, Moon, RefreshCw, Package, Wrench, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useFilters } from "@/lib/filters";
import { ReliabilityModal } from "@/components/facilities/ReliabilityModal";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DummyDataBadge } from "@/components/DummyDataBadge";

interface FacilitiesPageControlsProps {
  onSyncComplete?: () => void;
  onValidation?: () => void;
}

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

function PillShine() {
  return (
    <span className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-white/55 to-transparent dark:via-white/[0.10]" />
  );
}

// ── Sync config ───────────────────────────────────────────────────────────────


type SyncTarget = "insumos" | "equipamentos";
type SyncStep   = "closed" | "menu" | "key";

const SYNC_OPTIONS: { id: SyncTarget; icon: typeof Package; label: string; sublabel: string }[] = [
  { id: "insumos",      icon: Package, label: "Insumos",      sublabel: "facilities_insumos"      },
  { id: "equipamentos", icon: Wrench,  label: "Equipamentos", sublabel: "facilities_equipamentos" },
];

// ── Componente principal ──────────────────────────────────────────────────────

export function FacilitiesPageControls({ onSyncComplete, onValidation }: FacilitiesPageControlsProps) {
  const { theme, setTheme } = useTheme();
  const { removeOutliers, setRemoveOutliers, validationReport } = useFilters();
  const [reliabilityOpen, setReliabilityOpen] = useState(false);
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
    if (id === "insumos") {
      closeSync();
      handleInsumoSync();
      return;
    }
    setSyncTarget(id);
    setSyncStep("key");
    setTimeout(() => apiKeyRef.current?.focus(), 50);
  };

  const handleInsumoSync = async () => {
    if (syncing) return;
    setSyncing(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);
    try {
      const res = await fetch(SYNC_FACILITIES_URL, {
        method: "GET",
        signal: ctrl.signal,
      });

      const rawBody = await res.text().catch(() => "");
      let displayMsg = "";
      let bodyIsError = false;

      try {
        const json = JSON.parse(rawBody);
        displayMsg = json.message ?? json.detail ?? json.error ?? json.result ?? JSON.stringify(json);
        bodyIsError = json.status === "error" || json.success === false || (!json.message && !!json.error);
      } catch {
        displayMsg = rawBody;
      }

      const trimmed = displayMsg.slice(0, 240);

      if (!res.ok || bodyIsError) {
        toast.error(`Sync falhou${res.ok ? "" : ` (${res.status})`}${trimmed ? `: ${trimmed}` : ""}`, { duration: 8000 });
        return;
      }

      toast.success(trimmed || "Sync Insumos concluído.", { duration: 6000 });
      onSyncComplete?.();
      onValidation?.();
    } catch (err) {
      const msg = (err as Error).name === "AbortError" ? "Timeout (60s)." : "Falha de conexão com o servidor.";
      toast.error(msg);
    } finally {
      clearTimeout(timer);
      setSyncing(false);
    }
  };

  const handleConfirm = async () => {
    if (!apiKey.trim() || !syncTarget || syncing) return;
    setSyncing(true);

    // Equipamentos — endpoint pendente
    try {
      toast.success(`Sync ${syncTarget} iniciado.`);
      onSyncComplete?.();
      onValidation?.();
      closeSync();
    } catch {
      toast.error("Falha ao sincronizar.");
    } finally {
      setSyncing(false);
    }
  };

  const selectedOpt = SYNC_OPTIONS.find(o => o.id === syncTarget);

  return (
    <>
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
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className={singleBtn}
            >
              <PillShine />
              {isDark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6} className="text-[10px] px-2 py-0.5 rounded-lg font-medium">
            {isDark ? "Dark" : "Light"}
          </TooltipContent>
        </Tooltip>

        {/* ── 3. Sync ── */}
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
              {/* Dropdown 1 — menu de opções */}
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

              {/* Dropdown 2 — key input */}
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

        {/* ── 4. Outliers ── */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setRemoveOutliers(!removeOutliers)}
              className={cn(
                pillBase,
                "h-7 px-3 gap-1.5 cursor-pointer transition-all duration-150 active:scale-95",
                removeOutliers
                  ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/10 border-emerald-500/30 dark:border-emerald-500/25"
                  : "text-foreground/55 hover:text-foreground hover:bg-white/20 dark:hover:bg-white/[0.08]",
              )}
            >
              <PillShine />
              <span className="text-[10px] font-semibold">Outliers</span>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors duration-150",
                  removeOutliers ? "bg-emerald-500" : "bg-foreground/25",
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6} className="text-[10px] px-2 py-0.5 rounded-lg font-medium max-w-[240px]">
            Remove compras únicas acima de R$ 15.000 de todas as métricas
          </TooltipContent>
        </Tooltip>

        {/* ── 5. Confiabilidade da Base ── */}
        {validationReport && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setReliabilityOpen(true)}
                className={cn(
                  pillBase,
                  "h-7 px-3 gap-1.5 cursor-pointer transition-all duration-150 active:scale-95",
                  "text-foreground/65 hover:text-foreground hover:bg-white/20 dark:hover:bg-white/[0.08]",
                )}
              >
                <PillShine />
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    validationReport.healthColor === "green" ? "bg-emerald-500" :
                      validationReport.healthColor === "yellow" ? "bg-amber-400" : "bg-red-400",
                  )}
                />
                <span className="text-[10px] font-semibold tabular-nums">{validationReport.score}%</span>
                {validationReport.inconsistencies.length > 0 && (
                  <span className="text-[10px] text-foreground/40 tabular-nums">• {validationReport.inconsistencies.length}</span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="text-[10px] px-2 py-0.5 rounded-lg font-medium">
              Confiabilidade da base de dados
            </TooltipContent>
          </Tooltip>
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

      <ReliabilityModal open={reliabilityOpen} onOpenChange={setReliabilityOpen} />
    </>
  );
}
