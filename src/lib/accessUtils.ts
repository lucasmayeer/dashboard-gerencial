export type AppModule =
  | "direct-sales"
  | "facilities"
  | "bsa"
  | "direct-sales-ranking"
  | "bsa-ranking";

const MODULE_DEPT_MAP: Partial<Record<AppModule, string>> = {
  "direct-sales": "Direct Sales",
  "bsa":          "Business Services",
  "facilities":   "Facilities",
};

const RANKING_MODULES = new Set<AppModule>(["direct-sales-ranking", "bsa-ranking"]);

export function canAccessModule(
  userDepartment: string | null,
  isAdmin: boolean,
  module: AppModule,
): boolean {
  if (isAdmin) return true;
  if (RANKING_MODULES.has(module)) return true;
  if (!userDepartment) return false;
  return MODULE_DEPT_MAP[module] === userDepartment;
}
