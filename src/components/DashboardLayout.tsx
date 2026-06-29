import { useState } from "react";
import { useFilters } from "@/lib/filters";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart3, Table2, Clock, LogOut,
  LayoutDashboard, Package,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { FacilitiesPageControls } from "@/components/facilities/FacilitiesPageControls";
import { motion, AnimatePresence } from "framer-motion";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";

interface DashboardLayoutProps {
  children: React.ReactNode;
  onDataRefresh?: () => void;
}

const navItems = [
  { to: "/facilities",              label: "Resumo Mensal",      icon: LayoutDashboard, end: true },
  { to: "/facilities-visao-geral",  label: "Visão Geral",        icon: BarChart3 },
  { to: "/facilities-temporal",     label: "Visão Temporal",     icon: Clock },
  { to: "/facilities-detalhamento", label: "Detalhamento",       icon: Table2 },
  { to: "/facilities-estoque",      label: "Nosso Estoque",      icon: Package },
];

/* ── Mapa pathname → label do relatório ─────────────────────────────────── */
const pageLabels: Record<string, string> = {
  "/facilities":              "Resumo Mensal",
  "/facilities-visao-geral":  "Visão Geral",
  "/facilities-temporal":     "Visão Temporal",
  "/facilities-detalhamento": "Detalhamento",
  "/facilities-estoque":      "Nosso Estoque",
};

/* ── Logo acima da pill ──────────────────────────────────────────────────── */
function SidebarLogo({ expanded }: { expanded: boolean }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    /* wrapper com largura que acompanha a pill (46px colapsada → 200px expandida) */
    <motion.div
      className="pointer-events-auto flex items-center select-none overflow-hidden h-7"
      animate={{ width: expanded ? 200 : 46 }}
      transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className="shrink-0 flex items-center justify-center" style={{ width: 46 }}>
        <LayoutDashboard
          size={20}
          color={isDark ? "rgba(255,255,255,0.75)" : "#714B67"}
        />
      </div>

    </motion.div>
  );
}

/* ── Nav item ────────────────────────────────────────────────────────────── */
interface NavItemProps {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  expanded: boolean;
}

function NavItem({ to, label, icon: Icon, end, expanded }: NavItemProps) {
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
export function DashboardLayout({ children, onDataRefresh }: DashboardLayoutProps) {
  const { runValidation } = useFilters();
  useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* ── Floating sidebar — fixed, overlays content on expand ─────────── */}
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
          {navItems.map((item) => (
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
              "text-foreground/28 hover:text-foreground/55",
              "transition-all duration-150",
              expanded ? "justify-start" : "justify-center"
            )}
          >
            <LogOut className="h-[15px] w-[15px] shrink-0" />
            <AnimatePresence>
              {expanded && (
                <motion.span
                  className="text-[12px] font-medium whitespace-nowrap overflow-hidden"
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

      {/* ── Main content — ml fixo para o estado colapsado, sidebar sobrepõe ─ */}
      <div className="flex-1 ml-[96px]">
        <main className="px-6 pt-6 pb-8 max-w-[1400px] mx-auto">
          <div className="mb-6">
            <TooltipProvider>
              <FacilitiesPageControls onSyncComplete={onDataRefresh} onValidation={runValidation} />
            </TooltipProvider>
          </div>
          {children}
        </main>
      </div>

    </div>
  );
}
