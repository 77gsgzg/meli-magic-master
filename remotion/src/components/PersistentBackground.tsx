import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

export const PersistentBackground: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = f / 30;
  const x1 = 50 + Math.sin(t * 0.4) * 18;
  const y1 = 30 + Math.cos(t * 0.3) * 12;
  const x2 = 50 + Math.cos(t * 0.25) * 22;
  const y2 = 75 + Math.sin(t * 0.35) * 10;

  return (
    <AbsoluteFill style={{ background: COLORS.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 40% at ${x1}% ${y1}%, ${COLORS.cyan}22 0%, transparent 60%), radial-gradient(55% 45% at ${x2}% ${y2}%, ${COLORS.blue}26 0%, transparent 65%)`,
        }}
      />
      {/* Grid */}
      <AbsoluteFill
        style={{
          opacity: 0.08,
          backgroundImage:
            "linear-gradient(rgba(17,212,196,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(17,212,196,0.6) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          transform: `translateY(${(f * 0.6) % 80}px)`,
        }}
      />
      {/* Particles */}
      {Array.from({ length: 28 }).map((_, i) => {
        const seedX = (i * 137.5) % 100;
        const seedY = (i * 73.3) % 100;
        const speed = 0.15 + ((i * 11) % 30) / 100;
        const py = (seedY - t * speed * 8 + 200) % 100;
        const size = 2 + (i % 4);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${seedX}%`,
              top: `${py}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              background: i % 2 ? COLORS.cyan : COLORS.blue,
              boxShadow: `0 0 ${size * 4}px ${i % 2 ? COLORS.cyan : COLORS.blue}`,
              opacity: 0.5,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
