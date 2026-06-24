import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";

export const SceneHeatmap: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 18 } });
  const rot = interpolate(enter, [0, 1], [15, 0]);
  const op = interpolate(f, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const cols = 12;
  const rows = 16;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 1600 }}>
      <div style={{ opacity: op, transform: `rotateX(${rot}deg)`, width: 820 }}>
        <div style={{ color: COLORS.dim, fontFamily: "JetBrains Mono, monospace", fontSize: 22, letterSpacing: 2, marginBottom: 20 }}>
          // BUYER HEATMAP · REGIONS
        </div>
        <div
          style={{
            position: "relative",
            padding: 24,
            borderRadius: 24,
            border: `1px solid ${COLORS.cyan}30`,
            background: "linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
            boxShadow: `0 20px 80px ${COLORS.blue}30`,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: 6,
            }}
          >
            {Array.from({ length: cols * rows }).map((_, i) => {
              const x = i % cols;
              const y = Math.floor(i / cols);
              const cx = cols / 2;
              const cy = rows / 2 + Math.sin(f / 20) * 2;
              const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
              const intensity = Math.max(0, 1 - d / 7);
              const wave = interpolate(f - i * 0.6, [0, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const heat = intensity * wave;
              const color =
                heat > 0.66
                  ? COLORS.cyan
                  : heat > 0.33
                  ? COLORS.blue
                  : "#1a2030";
              return (
                <div
                  key={i}
                  style={{
                    aspectRatio: "1/1",
                    borderRadius: 6,
                    background: color,
                    opacity: 0.2 + heat * 0.8,
                    boxShadow: heat > 0.5 ? `0 0 ${heat * 24}px ${color}` : "none",
                  }}
                />
              );
            })}
          </div>
        </div>
        <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
          {["SP", "RJ", "MG", "PR", "RS"].map((s, i) => {
            const o = interpolate(f - 40 - i * 5, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div key={s} style={{ opacity: o, color: COLORS.white, fontFamily: "Inter, sans-serif", fontSize: 28, fontWeight: 600 }}>
                {s} <span style={{ color: COLORS.cyan }}>↑{12 + i * 3}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
