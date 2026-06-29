import { FlaskConical } from "lucide-react";

export function DummyDataBadge({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-500/80 border border-amber-500/20 ${className ?? ""}`}
    >
      <FlaskConical className="h-2.5 w-2.5 shrink-0" />
      Dados fictícios
    </span>
  );
}
