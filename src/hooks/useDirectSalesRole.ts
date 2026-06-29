export type UserRole = "ADMIN" | "MANAGER" | "TEAM_LEADER" | "EMPLOYEE";

export interface DirectSalesUser {
  userId: number;
  userName: string;
  userEmail: string | null;
  userRole: UserRole;
  managerId: number | null;
  managerName: string | null;
}

export interface UseDirectSalesRoleResult {
  dsUser: DirectSalesUser | null;
  loading: boolean;
}

const DEMO_DS_USER: DirectSalesUser = {
  userId: -1,
  userName: "Demo",
  userEmail: null,
  userRole: "ADMIN",
  managerId: null,
  managerName: null,
};

export function useDirectSalesRole(): UseDirectSalesRoleResult {
  return { dsUser: DEMO_DS_USER, loading: false };
}
