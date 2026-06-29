import { createContext, useContext, useState, type ReactNode } from "react";
import { useDirectSalesRole, type DirectSalesUser, type UserRole } from "@/hooks/useDirectSalesRole";

// =============================================================================
// TIPOS
// =============================================================================

export type ViewMode = "employee" | "team_leader" | "manager";

interface DirectSalesCtx {
  dsUser: DirectSalesUser | null;
  roleLoading: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  canSwitchView: boolean;
  canSync: boolean;
  // null quando ADMIN/MANAGER — veem todos os vendedores sem filtro
  filterUserId: number | null;
  // null quando ADMIN/MANAGER — veem todos os times sem filtro
  filterManagerId: number | null;
  // inclui dados pessoais do líder além do time; null fora de role=TEAM_LEADER
  filterTeamLeaderId: number | null;
  simulatedUserId: number | null;
  setSimulatedUserId: (id: number | null) => void;
}

// =============================================================================
// CONTEXT
// =============================================================================

const Ctx = createContext<DirectSalesCtx | undefined>(undefined);

export function useDirectSalesContext() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDirectSalesContext must be used within DirectSalesProvider");
  return ctx;
}

// =============================================================================
// HELPERS
// =============================================================================

function defaultViewMode(role: UserRole | undefined): ViewMode {
  if (!role) return "manager";          // null/ADMIN → visão gerencial
  if (role === "EMPLOYEE") return "employee";
  if (role === "TEAM_LEADER") return "team_leader";
  return "manager";                     // MANAGER e ADMIN
}

function canSwitch(role: UserRole | undefined): boolean {
  return !role || role === "ADMIN";
}

// =============================================================================
// PROVIDER
// =============================================================================

export function DirectSalesProvider({ children }: { children: ReactNode }) {
  const { dsUser, loading } = useDirectSalesRole();
  const [userChosenViewMode, setUserChosenViewMode] = useState<ViewMode>("manager");
  const [simulatedUserId, setSimulatedUserId] = useState<number | null>(null);

  const switchAllowed = canSwitch(dsUser?.userRole);
  const syncAllowed = dsUser?.userRole === "ADMIN" || dsUser?.userRole === "MANAGER";

  // Para usuários sem permissão de troca (EMPLOYEE, TEAM_LEADER, MANAGER),
  // viewMode é derivado diretamente da role — sem lag de useEffect.
  // ADMIN pode escolher livremente via userChosenViewMode.
  const viewMode: ViewMode = switchAllowed
    ? userChosenViewMode
    : defaultViewMode(dsUser?.userRole);

  const setViewMode = (mode: ViewMode) => {
    if (switchAllowed) setUserChosenViewMode(mode);
  };

  // Filtros server-side: só aplicados quando o usuário tem role fixo.
  // ADMIN pode simular um EMPLOYEE via simulatedUserId.
  const filterUserId: number | null =
    viewMode === "employee" && dsUser?.userRole === "EMPLOYEE"
      ? dsUser.userId
      : viewMode === "employee" && switchAllowed && simulatedUserId !== null
        ? simulatedUserId
        : null;

  const filterManagerId: number | null =
    viewMode === "team_leader" && dsUser?.userRole === "TEAM_LEADER"
      ? dsUser.userId
      : null;

  // userId do próprio líder — permite incluir seus dados pessoais além do time
  const filterTeamLeaderId: number | null =
    viewMode === "team_leader" && dsUser?.userRole === "TEAM_LEADER"
      ? dsUser.userId
      : null;

  return (
    <Ctx.Provider
      value={{
        dsUser,
        roleLoading: loading,
        viewMode,
        setViewMode,
        canSwitchView: switchAllowed,
        canSync: syncAllowed,
        filterUserId,
        filterManagerId,
        filterTeamLeaderId,
        simulatedUserId,
        setSimulatedUserId,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
