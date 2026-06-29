import { useNavigate } from "react-router-dom";
import { useFilters } from "@/lib/filters";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ReliabilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TYPE_LABELS: Record<string, string> = {
  math: "Inconsistências matemáticas",
  date: "Datas inválidas",
  duplicate: "Duplicidades",
  outlier: "Outliers extremos",
  qty: "Qtde inválida",
  negative: "Valores negativos",
  aggregation: "Divergência de agregação",
};

export function ReliabilityModal({ open, onOpenChange }: ReliabilityModalProps) {
  const { validationReport } = useFilters();
  const navigate = useNavigate();

  if (!validationReport) return null;

  const { score, healthColor, totalRecords, validRecords, inconsistencies, byType, lastAnalysis } = validationReport;
  const inconsistentCount = totalRecords - validRecords;
  const validPercent = totalRecords > 0 ? ((validRecords / totalRecords) * 100).toFixed(1) : "0";
  const inconsistentPercent = totalRecords > 0 ? ((inconsistentCount / totalRecords) * 100).toFixed(1) : "0";

  const progressColor =
    healthColor === "green"
      ? "bg-emerald-500"
      : healthColor === "yellow"
        ? "bg-amber-400"
        : "bg-red-400";

  const activeTypes = Object.entries(byType).filter(([, count]) => count > 0);

  const handleViewRecords = () => {
    onOpenChange(false);
    navigate("/facilities-detalhamento?inconsistencias=true");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] glass-card border-border/30">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Confiabilidade da Base
          </DialogTitle>
        </DialogHeader>

        {/* Thermometer */}
        <div className="flex flex-col items-center py-6">
          <span className={cn(
            "text-6xl font-bold tabular-nums",
            healthColor === "green" ? "text-emerald-500" : healthColor === "yellow" ? "text-amber-400" : "text-red-400"
          )}>
            {score}%
          </span>
          <div className="w-full mt-4">
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all duration-700", progressColor)}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Analisados</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{totalRecords}</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Válidos</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{validRecords}</p>
            <p className="text-[10px] text-muted-foreground tabular-nums">{validPercent}%</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Inconsistentes</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{inconsistentCount}</p>
            <p className="text-[10px] text-muted-foreground tabular-nums">{inconsistentPercent}%</p>
          </div>
        </div>

        {/* Type breakdown */}
        {activeTypes.length > 0 && (
          <div className="mt-4 space-y-2">
            {activeTypes.map(([type, count]) => (
              <div key={type} className="flex items-center justify-between px-2 py-1.5">
                <span className="text-xs text-muted-foreground">{TYPE_LABELS[type] || type}</span>
                <span className="text-xs font-semibold text-foreground tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-border/20 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground tabular-nums">
            Última análise: {lastAnalysis.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
          {inconsistencies.length > 0 && (
            <button
              onClick={handleViewRecords}
              className="glass-button px-3 py-1.5 rounded-xl text-[11px] font-medium"
            >
              Ver registros
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
