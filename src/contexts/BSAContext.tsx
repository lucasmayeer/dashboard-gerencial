import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useDirectSalesRole } from "@/hooks/useDirectSalesRole";
import { getDummyImplantacaoRows } from "@/lib/dummyDataLoader";
import { currentMonthKey } from "@/lib/bsaUtils";

export type BSAViewMode = "analyst" | "team_leader" | "manager";


interface BSACtx {
  viewMode: BSAViewMode;
  setViewMode: (mode: BSAViewMode) => void;
  canSwitchView: boolean;
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  availableMonths: string[];
  analysts: string[];
  analystsByManager: Record<string, string[]>;
  loadingAnalysts: boolean;
  selectedAnalyst: string | null;
  setSelectedAnalyst: (a: string | null) => void;
  teamLeaders: string[];
  selectedTeamLeader: string | null;
  setSelectedTeamLeader: (tl: string | null) => void;
  teamNames: string[];
  analystTeamName: Record<string, string>;
  managerTeamName: Record<string, string>;
}

const Ctx = createContext<BSACtx | undefined>(undefined);

export function useBSAContext() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBSAContext must be used within BSAProvider");
  return ctx;
}

function roleToViewMode(role: string): BSAViewMode {
  if (role === "TEAM_LEADER") return "team_leader";
  if (role === "MANAGER" || role === "ADMIN") return "manager";
  return "analyst";
}

export function BSAProvider({ children }: { children: ReactNode }) {
  const { dsUser, loading: roleLoading } = useDirectSalesRole();
  const [viewMode, setViewModeState] = useState<BSAViewMode>("manager");
  const [viewModeInitialized, setViewModeInitialized] = useState(false);
  const [selectedMonth, setSelectedMonthState] = useState<string>("2026-12");
  const [analysts, setAnalysts] = useState<string[]>([]);
  const [analystsByManager, setAnalystsByManager] = useState<Record<string, string[]>>({});
  const [loadingAnalysts, setLoadingAnalysts] = useState(false);
  const [selectedAnalyst, setSelectedAnalyst] = useState<string | null>(null);
  const [teamLeaders, setTeamLeaders] = useState<string[]>([]);
  const [selectedTeamLeader, setSelectedTeamLeader] = useState<string | null>(null);
  const [availableMonths, setAvailableMonths] = useState<string[]>(["2026-12"]);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [analystTeamName, setAnalystTeamName] = useState<Record<string, string>>({});
  const [managerTeamName, setManagerTeamName] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!roleLoading && dsUser && !viewModeInitialized) {
      setViewModeState(roleToViewMode(dsUser.userRole));
      setViewModeInitialized(true);
    }
  }, [roleLoading, dsUser, viewModeInitialized]);

  // Lock selection to the logged-in user's identity (ADMIN uses manual selector)
  useEffect(() => {
    if (roleLoading || !dsUser || loadingAnalysts) return;
    if (dsUser.userRole === "ADMIN") return;
    const myName = dsUser.userName;
    if (viewMode === "analyst") {
      setSelectedAnalyst(analysts.includes(myName) ? myName : null);
    } else if (viewMode === "team_leader") {
      setSelectedTeamLeader(teamLeaders.includes(myName) ? myName : null);
    }
  }, [viewMode, dsUser, analysts, teamLeaders, loadingAnalysts, roleLoading]);

  const canSwitchView = dsUser?.userRole === "ADMIN";

  const setViewMode = (mode: BSAViewMode) => {
    if (canSwitchView) setViewModeState(mode);
  };

  const setSelectedMonth = (m: string) => {
    setSelectedMonthState(m);
    setSelectedAnalyst(null);
    setSelectedTeamLeader(null);
  };

  useEffect(() => {
    async function fetchAvailableMonths() {
      const allRows = await getDummyImplantacaoRows();
      const dates = allRows.map((r) => r.report_date).filter(Boolean).sort();
      if (!dates.length) return;
      const minKey = dates[0].slice(0, 7);
      const maxKey = dates[dates.length - 1].slice(0, 7);

      const months: string[] = [];
      let [y, m] = maxKey.split("-").map(Number);
      const [minY, minM] = minKey.split("-").map(Number);
      while (y > minY || (y === minY && m >= minM)) {
        months.push(`${y}-${String(m).padStart(2, "0")}`);
        m--; if (m === 0) { m = 12; y--; }
      }
      setAvailableMonths(months);
      const next = months[0] ?? currentMonthKey();
      setSelectedMonthState(next);
    }
    fetchAvailableMonths();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchPeople() {
      setLoadingAnalysts(true);
      const [year, month] = selectedMonth.split("-").map(Number);
      const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const dateTo = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const allRows = await getDummyImplantacaoRows();
      const data = allRows.filter((r) => r.report_date >= dateFrom && r.report_date <= dateTo && r.user_name);

      if (!cancelled && data) {
        const rows = data;

        const uniqueAnalysts = [...new Set(rows.map((r) => r.user_name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const uniqueTLs = [...new Set(rows.map((r) => r.manager_name).filter(Boolean))].sort((a, b) => a.localeCompare(b));

        // Build manager → analysts[] map
        const byManager: Record<string, string[]> = {};
        for (const row of rows) {
          const mgr = row.manager_name;
          const usr = row.user_name;
          if (!mgr || !usr) continue;
          if (!byManager[mgr]) byManager[mgr] = [];
          if (!byManager[mgr].includes(usr)) byManager[mgr].push(usr);
        }
        for (const mgr of Object.keys(byManager)) byManager[mgr].sort((a, b) => a.localeCompare(b));

        // team_name maps
        const uniqueTeamNames = [...new Set(rows.map((r) => r.team_name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const analystTN: Record<string, string> = {};
        const managerTN: Record<string, string> = {};
        for (const row of rows) {
          if (row.user_name && row.team_name) analystTN[row.user_name] = row.team_name;
          if (row.manager_name && row.team_name) managerTN[row.manager_name] = row.team_name;
        }

        setAnalysts(uniqueAnalysts);
        setAnalystsByManager(byManager);
        setTeamLeaders(uniqueTLs);
        setTeamNames(uniqueTeamNames);
        setAnalystTeamName(analystTN);
        setManagerTeamName(managerTN);

        // Auto-select first (same pattern as Direct Sales sellers[0])
        setSelectedAnalyst((prev) => prev ?? uniqueAnalysts[0] ?? null);
        setSelectedTeamLeader((prev) => prev ?? uniqueTLs[0] ?? null);
      }
      if (!cancelled) setLoadingAnalysts(false);
    }
    fetchPeople();
    return () => { cancelled = true; };
  }, [selectedMonth]);

  return (
    <Ctx.Provider value={{
      viewMode, setViewMode, canSwitchView,
      selectedMonth, setSelectedMonth, availableMonths,
      analysts, analystsByManager, loadingAnalysts,
      selectedAnalyst, setSelectedAnalyst,
      teamLeaders, selectedTeamLeader, setSelectedTeamLeader,
      teamNames, analystTeamName, managerTeamName,
    }}>
      {children}
    </Ctx.Provider>
  );
}
