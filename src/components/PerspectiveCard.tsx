import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PerspectiveCardProps {
  children: ReactNode;
  className?: string;
}

export function PerspectiveCard({ children, className }: PerspectiveCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setStyle({
      transform: `perspective(800px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) scale(1.03)`,
      transition: "transform 0.1s ease-out",
    });
  };

  const handleLeave = () => {
    setStyle({
      transform: "perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)",
      transition: "transform 0.4s ease-out",
    });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ ...style, transformStyle: "preserve-3d" }}
      className={cn("will-change-transform", className)}
    >
      {children}
    </div>
  );
}
