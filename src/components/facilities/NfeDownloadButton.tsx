import { FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface NfeDownloadButtonProps {
  nfeFileName: string;
}

export function NfeDownloadButton({ nfeFileName: _nfeFileName }: NfeDownloadButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toast({ title: "Indisponível na versão demo", description: "Download de NFe requer integração com backend.", variant: "destructive" });
      }}
      className="text-primary hover:text-primary/80 transition-colors"
    >
      <FileText className="h-3.5 w-3.5" />
    </button>
  );
}
