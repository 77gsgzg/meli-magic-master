import React from "react";
import { COLORS } from "../theme";

export const RuxovLogo: React.FC<{ size?: number; glow?: number }> = ({
  size = 220,
  glow = 1,
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: size * 0.12,
        filter: `drop-shadow(0 0 ${30 * glow}px ${COLORS.cyan}cc) drop-shadow(0 0 ${60 * glow}px ${COLORS.blue}80)`,
      }}
    >
      <svg width={size * 0.9} height={size * 0.9} viewBox="0 0 100 100">
        <defs>
          <linearGradient id="rxg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={COLORS.cyan} />
            <stop offset="100%" stopColor={COLORS.blue} />
          </linearGradient>
        </defs>
        <path
          d="M20 80 V25 H55 a18 18 0 0 1 0 36 H40 l28 19"
          stroke="url(#rxg)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="55" cy="43" r="6" fill="url(#rxg)" />
      </svg>
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 800,
          fontSize: size * 0.55,
          letterSpacing: -size * 0.012,
          background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.blue})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          lineHeight: 1,
        }}
      >
        ruxov
      </div>
    </div>
  );
};
