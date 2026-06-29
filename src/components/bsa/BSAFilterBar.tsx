import { Camera, CalendarDays } from "lucide-react";
import { useBSAContext } from "@/contexts/BSAContext";
import { formatMonthLabel } from "@/lib/directSalesUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const btn = "glass-button flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0";

export function BSAFilterBar({ hidePictureMode = false }: { hidePictureMode?: boolean }) {
  const { viewMode, selectedMonth, setSelectedMonth, availableMonths } = useBSAContext();

  return (
    <div className="flex items-center gap-2 shrink-0">

      {!hidePictureMode && viewMode !== "manager" && (
        <button className={btn}>
          <Camera className="h-3.5 w-3.5 shrink-0" />
          Picture Mode
        </button>
      )}

      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
        <SelectTrigger className="w-[155px] h-8 text-xs glass-button border-0 gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          {availableMonths.map((m) => (
            <SelectItem key={m} value={m} className="text-xs">
              {formatMonthLabel(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

    </div>
  );
}
