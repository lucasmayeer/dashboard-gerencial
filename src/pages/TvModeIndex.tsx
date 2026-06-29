import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { DesempenhoMensalPage } from "./tv-mode/direct-sales/DesempenhoMensalPage";

/* ── Icon mark ───────────────────────────────────────────────────────────── */
function DashIconMark({ isDark }: { isDark: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
      <circle
        cx="16" cy="16" r="11"
        stroke={isDark ? "rgba(255,255,255,0.75)" : "#714B67"}
        strokeWidth="3.5"
        fill="none"
      />
    </svg>
  );
}

/* ── Logo ────────────────────────────────────────────────────────────────── */
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

/* ── Layout ──────────────────────────────────────────────────────────────── */
const TvModeIndex = () => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* ── Floating sidebar — logo + sair apenas ──────────────────────── */}
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
          <button
            onClick={() => navigate("/welcome")}
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

      {/* ── Main content ───────────────────────────────────────────────── */}
      <div className="flex-1 ml-[96px]">
        <main className="px-6 py-8 max-w-[1400px] mx-auto">
          <DesempenhoMensalPage />
        </main>
      </div>
    </div>
  );
};

export default TvModeIndex;
