import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { generateTlLabel, type TlOp, type TlMultiplierRow } from "@/lib/tlUtils";

export interface TlBracketSaveParams {
  mrrId: string;
  nrrId: string | undefined;
  minOp: TlOp;
  maxOp: TlOp;
  minPctStr: string;
  maxPctStr: string;
  mrrMultiplierStr: string;
  nrrMultiplierStr: string;
}

export function useTlBracketMutation(
  tlRows: TlMultiplierRow[],
  onTlRowsChange: (rows: TlMultiplierRow[]) => void
) {
  const [saving, setSaving] = useState(false);

  async function saveBracket(params: TlBracketSaveParams): Promise<boolean> {
    const { mrrId, nrrId, minOp, maxOp } = params;
    const minPct = parseFloat(params.minPctStr);
    const maxPct = params.maxPctStr.trim() === "" ? null : parseFloat(params.maxPctStr);
    const mrrMult = parseFloat(params.mrrMultiplierStr);
    const nrrMult = parseFloat(params.nrrMultiplierStr);

    if (isNaN(minPct) || minPct < 0) {
      toast({ title: "Valor mínimo inválido", description: "Deve ser >= 0.", variant: "destructive" });
      return false;
    }
    if (maxPct !== null && (isNaN(maxPct) || maxPct <= minPct)) {
      toast({ title: "Valor máximo inválido", description: "Deve ser maior que o mínimo. Deixe vazio para sem teto.", variant: "destructive" });
      return false;
    }
    if (isNaN(mrrMult) || mrrMult <= 0 || isNaN(nrrMult) || nrrMult <= 0) {
      toast({ title: "Multiplier inválido", description: "MRR e NRR devem ser maiores que zero.", variant: "destructive" });
      return false;
    }

    const label = generateTlLabel(minOp, minPct, maxOp, maxPct);
    setSaving(true);
    const now = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [r1, r2] = await Promise.all([
      (supabase.from("tl_commission_multipliers" as any) as any)
        .update({ min_op: minOp, max_op: maxOp, min_pct: minPct, max_pct: maxPct, multiplier: mrrMult, label, updated_at: now })
        .eq("id", mrrId),
      (supabase.from("tl_commission_multipliers" as any) as any)
        .update({ min_op: minOp, max_op: maxOp, min_pct: minPct, max_pct: maxPct, multiplier: nrrMult, label, updated_at: now })
        .eq("id", nrrId),
    ]);

    if (r1.error || r2.error) {
      toast({ title: "Erro ao salvar", description: r1.error?.message ?? r2.error?.message ?? "Tente novamente.", variant: "destructive" });
      setSaving(false);
      return false;
    }

    onTlRowsChange(tlRows.map((r) => {
      if (r.id === mrrId) return { ...r, min_op: minOp, max_op: maxOp, min_pct: minPct, max_pct: maxPct, multiplier: mrrMult, label, updated_at: now };
      if (r.id === nrrId) return { ...r, min_op: minOp, max_op: maxOp, min_pct: minPct, max_pct: maxPct, multiplier: nrrMult, label, updated_at: now };
      return r;
    }));
    setSaving(false);
    toast({ title: "Salvo!", description: `Bracket "${label}" atualizado.` });
    return true;
  }

  return { saving, saveBracket };
}
