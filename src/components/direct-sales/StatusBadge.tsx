import { memo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const StatusBadge = memo(function StatusBadge({ status }: { status: "ativo" | "ramp-up" | "férias" | "inativo" }) {
  if (status === "inativo") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-block h-2 w-2 rounded-full bg-red-500 shrink-0 cursor-default"
            aria-label="Inativo"
          />
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs font-medium">Inativo</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  if (status === "ramp-up") {
    return (
      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20 shrink-0">
        Ramp-up
      </span>
    );
  }
  if (status === "férias") {
    return (
      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20 shrink-0">
        Em Férias
      </span>
    );
  }
  return null;
});
