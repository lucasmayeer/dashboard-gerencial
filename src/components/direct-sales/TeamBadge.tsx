import { memo } from "react";
import { TEAM_NAME_FIXED_COLORS, TEAM_NAME_FALLBACK_COLORS, hashTeamName } from "@/lib/directSalesUtils";

export const TeamBadge = memo(function TeamBadge({ teamName }: { teamName: string | null | undefined }) {
  if (!teamName) return null;
  const color = TEAM_NAME_FIXED_COLORS[teamName] ?? TEAM_NAME_FALLBACK_COLORS[hashTeamName(teamName)];
  const label = teamName.length > 22 ? teamName.slice(0, 20) + "…" : teamName;
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold shrink-0"
      style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}
    >
      {label}
    </span>
  );
});
