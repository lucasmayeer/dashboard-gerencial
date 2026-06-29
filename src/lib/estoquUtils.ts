import { Equipment } from "./data";

export interface CategoryConfig {
  icon: React.ElementType;
  showValue: boolean;
  showAvg: boolean;
  labels: { employee: string; stock: string };
  canHaveEmployee: boolean;
  needsPatrimonialId: boolean;
  checkDuplicateEmployee: boolean;
  useNameClassification?: boolean;
  showOnlyValueAndItems?: boolean;
  showCountOnly?: boolean;
  countLabel?: string;
  showModelVariation: boolean;
  group: 1 | 2 | 3;
}

export interface ModelDetail {
  model: string;
  avgCost: number;
  count: number;
}

export interface CategoryData {
  name: string;
  totalValue: number;
  avgValue: number;
  withEmployee: number;
  inStock: number;
  total: number;
  items: Equipment[];
  config: CategoryConfig;
  modelCount: number;
  modelBreakdown: ModelDetail[];
}

export interface Inconsistency {
  type: "duplicate_id" | "duplicate_employee" | "improper_employee" | "missing_id" | "classification";
  description: string;
}

export type FilterMode = "all" | "instock" | "employee";
export type TypeFilter = "all" | 1 | 2 | 3;

import {
  Laptop, Headphones, Monitor, Keyboard, Mouse,
  Wifi, Plug, Lock, ParkingCircle, BookOpen, Package,
} from "lucide-react";

export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  "Notebook": {
    icon: Laptop, showValue: true, showAvg: true,
    labels: { employee: "Com Funcionário", stock: "Em Estoque" },
    canHaveEmployee: true, needsPatrimonialId: false, checkDuplicateEmployee: true,
    showModelVariation: true, group: 1,
  },
  "Monitor": {
    icon: Monitor, showValue: true, showAvg: true,
    labels: { employee: "Em Mesa", stock: "Em Estoque" },
    canHaveEmployee: false, needsPatrimonialId: false, checkDuplicateEmployee: false,
    showModelVariation: true, group: 1,
  },
  "Headset": {
    icon: Headphones, showValue: true, showAvg: true,
    labels: { employee: "Com Funcionário", stock: "Em Estoque" },
    canHaveEmployee: true, needsPatrimonialId: false, checkDuplicateEmployee: true,
    showModelVariation: true, group: 1,
  },
  "Teclado": {
    icon: Keyboard, showValue: true, showAvg: true,
    labels: { employee: "Em Uso", stock: "Em Estoque" },
    canHaveEmployee: false, needsPatrimonialId: false, checkDuplicateEmployee: false,
    useNameClassification: true, showModelVariation: true, group: 1,
  },
  "Mouse": {
    icon: Mouse, showValue: true, showAvg: true,
    labels: { employee: "Em Uso", stock: "Em Estoque" },
    canHaveEmployee: false, needsPatrimonialId: false, checkDuplicateEmployee: false,
    useNameClassification: true, showModelVariation: true, group: 1,
  },
  "Internet e Outros Equipamentos": {
    icon: Wifi, showValue: true, showAvg: false,
    labels: { employee: "Com Funcionário", stock: "Em Estoque" },
    canHaveEmployee: false, needsPatrimonialId: false, checkDuplicateEmployee: false,
    showOnlyValueAndItems: true, showModelVariation: true, group: 2,
  },
  "Eletrodomésticos": {
    icon: Plug, showValue: true, showAvg: false,
    labels: { employee: "Com Funcionário", stock: "Em Estoque" },
    canHaveEmployee: false, needsPatrimonialId: false, checkDuplicateEmployee: false,
    showOnlyValueAndItems: true, showModelVariation: true, group: 2,
  },
  "Estacionamento": {
    icon: ParkingCircle, showValue: false, showAvg: false,
    labels: { employee: "Em Uso", stock: "Livres" },
    canHaveEmployee: true, needsPatrimonialId: false, checkDuplicateEmployee: true,
    showCountOnly: true, countLabel: "Vagas", showModelVariation: false, group: 3,
  },
  "Livros": {
    icon: BookOpen, showValue: false, showAvg: false,
    labels: { employee: "Em Uso", stock: "Livres" },
    canHaveEmployee: true, needsPatrimonialId: false, checkDuplicateEmployee: false,
    showCountOnly: true, countLabel: "Livros", showModelVariation: false, group: 3,
  },
  "Armário": {
    icon: Lock, showValue: false, showAvg: false,
    labels: { employee: "Em Uso", stock: "Livres" },
    canHaveEmployee: true, needsPatrimonialId: false, checkDuplicateEmployee: true,
    showCountOnly: true, countLabel: "Armários", showModelVariation: false, group: 3,
  },
};

export function getConfig(cat: string): CategoryConfig {
  return CATEGORY_CONFIG[cat] || {
    icon: Package, showValue: true, showAvg: true,
    labels: { employee: "Com Funcionário", stock: "Em Estoque" },
    canHaveEmployee: true, needsPatrimonialId: true, checkDuplicateEmployee: false,
    showModelVariation: false, group: 3,
  };
}

export function groupLabel(group: 1 | 2 | 3): string {
  if (group === 1) return "Equipamentos";
  if (group === 2) return "Eletro & Internet";
  return "Outros";
}

export function typeBadgeClass(group: 1 | 2 | 3): string {
  if (group === 1) return "bg-primary/10 text-primary/80";
  if (group === 2) return "bg-accent/10 text-accent/80";
  return "bg-muted/50 text-muted-foreground";
}

export function classifyItem(e: Equipment, cfg: CategoryConfig): "employee" | "stock" {
  if (cfg.useNameClassification) {
    return e.nomeEquipamento.includes("(No Estoque)") ? "stock" : "employee";
  }
  if (e.categoria === "Monitor") {
    return e.nomeEquipamento.includes("(No Estoque)") ? "stock" : "employee";
  }
  return e.funcionario ? "employee" : "stock";
}

export function computeValidations(equipment: Equipment[]): Inconsistency[] {
  const issues: Inconsistency[] = [];

  const idMap = new Map<string, string[]>();
  equipment.forEach((e) => {
    const pid = e.nomeEquipamento.match(/\[(\d{5})\]/)?.[1];
    if (pid) {
      if (!idMap.has(pid)) idMap.set(pid, []);
      idMap.get(pid)!.push(e.nomeEquipamento);
    }
  });
  idMap.forEach((names, pid) => {
    if (names.length > 1) {
      issues.push({ type: "duplicate_id", description: `ID [${pid}] aparece ${names.length}x: ${names.join(", ")}` });
    }
  });

  const empCatMap = new Map<string, Map<string, number>>();
  equipment.forEach((e) => {
    if (!e.funcionario) return;
    const cfg = getConfig(e.categoria);
    if (!cfg.checkDuplicateEmployee) return;
    if (!empCatMap.has(e.funcionario)) empCatMap.set(e.funcionario, new Map());
    const cats = empCatMap.get(e.funcionario)!;
    cats.set(e.categoria, (cats.get(e.categoria) || 0) + 1);
  });
  empCatMap.forEach((cats, emp) => {
    cats.forEach((count, cat) => {
      if (count > 1) {
        issues.push({ type: "duplicate_employee", description: `${emp} tem ${count} "${cat}"` });
      }
    });
  });

  equipment.forEach((e) => {
    if (!e.funcionario) return;
    const cfg = getConfig(e.categoria);
    if (!cfg.canHaveEmployee) {
      issues.push({ type: "improper_employee", description: `"${e.nomeEquipamento}" (${e.categoria}) não deveria ter funcionário: ${e.funcionario}` });
    }
  });

  equipment.forEach((e) => {
    const cfg = getConfig(e.categoria);
    if (!cfg.needsPatrimonialId) return;
    const pid = e.nomeEquipamento.match(/\[(\d{5})\]/)?.[1];
    if (!pid) {
      issues.push({ type: "missing_id", description: `"${e.nomeEquipamento}" (${e.categoria}) sem ID patrimonial` });
    }
  });

  return issues;
}

export function splitEquipmentName(name: string): { mainName: string; idTag: string | null } {
  const match = name.match(/^(.*?)(\[\d{5}\].*)$/);
  if (match) return { mainName: match[1].trim(), idTag: match[2].trim() };
  return { mainName: name, idTag: null };
}
