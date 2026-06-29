import { useState, useEffect, useMemo } from "react";
import { loadEquipment, Equipment } from "@/lib/data";
import { computeValidations } from "@/lib/estoquUtils";

export function useEquipmentData() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEquipment().then((data) => { setEquipment(data); setLoading(false); });
  }, []);

  const validations = useMemo(() => computeValidations(equipment), [equipment]);

  return { equipment, loading, validations };
}
