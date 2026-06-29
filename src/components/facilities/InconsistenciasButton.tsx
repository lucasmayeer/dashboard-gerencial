import { useNavigate } from "react-router-dom";
import { useFilters } from "@/lib/filters";

export function InconsistenciasButton() {
  const { validationReport } = useFilters();
  const navigate = useNavigate();
  if (!validationReport || validationReport.inconsistencies.length === 0) return null;
  return (
    <button
      onClick={() => navigate("/facilities-detalhamento?inconsistencias=true")}
      className="glass-button flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-medium text-muted-foreground hover:text-foreground transition-all"
    >
      Ver inconsistências ({validationReport.inconsistencies.length})
    </button>
  );
}
