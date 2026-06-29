import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Clock, Trophy, TrendingUp, LogOut, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { BSAProvider } from "@/contexts/BSAContext";
import { BSAPageControls } from "@/components/bsa/BSAPageControls";
import { ResumoHorasPage } from "./bsa/ResumoHorasPage";
import { RankingBSAPage } from "./bsa/RankingBSAPage";
import { DesempenhoDeptoPage } from "./bsa/DesempenhoDeptoPage";

interface BSAIndexProps {
  page?: "resumo-horas" | "ranking" | "departamento";
}

const NAV_ITEMS = [
  { to: "/bsa",               label: "Resumo de Horas",          icon: Clock,       end: true  },
  { to: "/bsa/ranking",       label: "Ranking",                  icon: Trophy,      end: false },
  { to: "/bsa/departamento",  label: "Desempenho do Depto.",     icon: TrendingUp,  end: false },
];

/* ── Icon mark ───────────────────────────────────────────────────────────── */
function DashIconMark({ isDark }: { isDark: boolean }) {
  return (
    <LayoutDashboard
      size={20}
      color={isDark ? "rgba(255,255,255,0.75)" : "#714B67"}
    />
  );
}

/* ── Logo ─────────────────────────────────────────────────────────────────── */
function SidebarLogo({ expanded }: { expanded: boolean }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <motion.div
      className="pointer-events-auto flex items-center select-none overflow-hidden h-7"
      animate={{ width: expanded ? 200 : 46 }}
      transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className="shrink-0 flex items-center justify-center" style={{ width: 46 }}>
        <DashIconMark isDark={isDark} />
      </div>
    </motion.div>
  );
}

/* ── Nav item ────────────────────────────────────────────────────────────── */
function NavItem({ to, label, icon: Icon, end, expanded }: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end: boolean;
  expanded: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-0 px-[10px] py-[8px] rounded-xl transition-all duration-150",
          expanded ? "justify-start" : "justify-center",
          isActive
            ? "font-semibold text-foreground"
            : "font-normal text-foreground/50 hover:text-foreground/70"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("h-[15px] w-[15px] shrink-0 transition-colors", isActive && "nav-golden-active-icon")} />
          <AnimatePresence>
            {expanded && (
              <motion.span
                className={cn(
                  "text-[12px] whitespace-nowrap overflow-hidden",
                  isActive ? "font-semibold nav-golden-active" : "font-normal"
                )}
                initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                animate={{ opacity: 1, width: "auto", marginLeft: 9 }}
                exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </>
      )}
    </NavLink>
  );
}

/* ── Layout ──────────────────────────────────────────────────────────────── */
function BSALayout({ page }: BSAIndexProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const renderPage = () => {
    switch (page) {
      case "ranking":      return <RankingBSAPage />;
      case "departamento": return <DesempenhoDeptoPage />;
      default:             return <ResumoHorasPage />;
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Floating sidebar ─────────────────────────────────────────────── */}
      <div
        className="fixed left-[37px] inset-y-0 z-40 flex flex-col items-start justify-center gap-3 pointer-events-none"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <SidebarLogo expanded={expanded} />

        <motion.nav
          className={cn(
            "pointer-events-auto flex flex-col gap-[2px] p-[8px] overflow-hidden",
            "rounded-2xl",
            "bg-sidebar-background/85 backdrop-blur-xl",
            "border border-border/20 dark:border-sidebar-border/50",
            "shadow-[0_2px_16px_-4px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.04)]",
            "dark:shadow-[0_6px_32px_-8px_rgba(0,0,0,0.40),inset_0_1px_0_rgba(255,255,255,0.05)]",
          )}
          animate={{ width: expanded ? 200 : 46 }}
          transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              end={item.end}
              expanded={expanded}
            />
          ))}

          <div className="relative my-[5px] mx-1">
            <div className="h-px bg-foreground/10" />
            <div className="h-[3px] bg-gradient-to-b from-black/[0.04] to-transparent blur-[1px]" />
          </div>

          <button
            onClick={() => navigate("/reports")}
            className={cn(
              "flex items-center px-[10px] py-[8px] rounded-xl",
              "text-foreground/50 hover:text-foreground/70",
              "transition-all duration-150",
              expanded ? "justify-start" : "justify-center"
            )}
          >
            <LogOut className="h-[15px] w-[15px] shrink-0" />
            <AnimatePresence>
              {expanded && (
                <motion.span
                  className="text-[12px] font-normal whitespace-nowrap overflow-hidden"
                  initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                  animate={{ opacity: 1, width: "auto", marginLeft: 9 }}
                  exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                  transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  Sair do relatório
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </motion.nav>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 ml-[96px]">
        <main className="px-6 py-8 max-w-[1400px] mx-auto">
          <div className="mb-6">
            <BSAPageControls />
          </div>
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

/* ── Export com Provider ─────────────────────────────────────────────────── */
const BSAIndex = ({ page = "resumo-horas" }: BSAIndexProps) => (
  <BSAProvider>
    <BSALayout page={page} />
  </BSAProvider>
);

export default BSAIndex;
