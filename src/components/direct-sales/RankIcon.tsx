import { memo } from "react";
import { Crown, Medal } from "lucide-react";

export const RankIcon = memo(function RankIcon({ rank, size = 14 }: { rank: number; size?: number }) {
  if (rank === 1) return <Crown className="shrink-0" style={{ width: size, height: size, color: "#EAB308" }} />;
  if (rank === 2) return <Medal className="shrink-0" style={{ width: size, height: size, color: "#9CA3AF" }} />;
  if (rank === 3) return <Medal className="shrink-0" style={{ width: size, height: size, color: "#B45309" }} />;
  return null;
});
