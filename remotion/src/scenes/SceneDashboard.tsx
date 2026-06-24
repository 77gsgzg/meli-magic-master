import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      background: "linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
      border: `1px solid ${COLORS.cyan}30`,
      borderRadius: 24,
      padding: 28,
      backdropFilter: "blur(4px)",
      boxShadow: `0 10px 60px ${COLORS.blue}25`,
      ...style,
    }}
  >
    {children}
  </div>
);

export const SceneDashboard: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 18 } });
  const scale = interpolate(f, [0, 120], [1, 1.08]);
  const rot = interpolate(enter, [0, 1], [15, 0]);
  const op = interpolate(f, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const bars = [62, 78, 45, 91, 68, 83, 55];
  const barGrow = (i: number) =>
    interpolate(f - 10 - i * 3, [0, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const revenue = Math.floor(interpolate(f, [10, 80], [0, 487320], { extrapolateRight: "clamp" }));

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 1600 }}>
      <div style={{ opacity: op, transform: `rotateX(${rot}deg) scale(${scale})`, width: 880 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: COLORS.cyan, boxShadow: `0 0 16px ${COLORS.cyan}` }} />
          <div style={{ color: COLORS.dim, fontFamily: "JetBrains Mono, monospace", fontSize: 22, letterSpacing: 2 }}>
            AI COMMAND PANEL · LIVE
          </div>
        </div>
        <Card style={{ marginBottom: 20 }}>
          <div style={{ color: COLORS.dim, fontSize: 22, fontFamily: "Inter, sans-serif" }}>Receita · 30d</div>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 800,
              fontSize: 84,
              background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.blue})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              lineHeight: 1.05,
            }}
          >
            R$ {revenue.toLocaleString("pt-BR")}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 200, marginTop: 24 }}>
            {bars.map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h * barGrow(i)}%`,
                  background: `linear-gradient(180deg, ${COLORS.cyan}, ${COLORS.blue})`,
                  borderRadius: 8,
                  boxShadow: `0 0 24px ${COLORS.cyan}80`,
                }}
              />
            ))}
          </div>
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {[
            { label: "Pedidos", value: "1.284" },
            { label: "Conversão", value: "12.4%" },
            { label: "ROI", value: "4.8x" },
          ].map((m, i) => {
            const o = interpolate(f - 40 - i * 6, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <Card key={i} style={{ opacity: o }}>
                <div style={{ color: COLORS.dim, fontSize: 20 }}>{m.label}</div>
                <div style={{ color: COLORS.white, fontSize: 44, fontWeight: 700, fontFamily: "Inter, sans-serif" }}>{m.value}</div>
              </Card>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
