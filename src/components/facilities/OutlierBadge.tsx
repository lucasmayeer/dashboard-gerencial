import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function OutlierBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3 w-3 text-red-500 inline-block ml-1 cursor-pointer" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[300px]">
          <p className="text-xs">
            Este valor está sendo exibido com o filtro Remover Outliers ativado.
            Compras únicas acima de R$ 15.000,00 foram desconsideradas no cálculo.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
