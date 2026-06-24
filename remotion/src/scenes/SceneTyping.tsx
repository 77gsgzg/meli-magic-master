import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../theme";

const FULL = `Smartwatch Pro X1 — Bateria 14 dias, GPS, monitor cardíaco premium. Entrega expressa em todo o Brasil. Frete grátis para SP, RJ e MG.`;

export const SceneTyping: React.FC = () => {
  const f = useCurrentFrame();
  const startTitle = 0;
  const titleOp = interpolate(f, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const chars = Math.max(0, Math.min(FULL.length, Math.floor((f - 20) * 1.4)));
  const text = FULL.slice(0, chars);
  const cursor = Math.floor(f / 8) % 2 === 0;
  const scale = interpolate(f, [0, 300], [1, 1.05]);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div style={{ width: "100%", maxWidth: 880, transform: `scale(${scale})` }}>
        <div style={{ opacity: titleOp, color: COLORS.dim, fontFamily: "JetBrains Mono, monospace", fontSize: 24, letterSpacing: 2, marginBottom: 32 }}>
          // COPYWRITING IA · v3.2
        </div>
        <div
          style={{
            background: "linear-gradient(160deg, rgba(17,212,196,0.08), rgba(6,168,249,0.04))",
            border: `1px solid ${COLORS.cyan}40`,
            borderRadius: 28,
            padding: 48,
            minHeight: 480,
            boxShadow: `0 30px 100px ${COLORS.blue}40, inset 0 0 60px ${COLORS.cyan}10`,
          }}
        >
          <div
            style={{
              color: COLORS.white,
              fontFamily: "Inter, sans-serif",
              fontSize: 44,
              lineHeight: 1.4,
              fontWeight: 500,
            }}
          >
            {text}
            <span style={{ opacity: cursor ? 1 : 0, color: COLORS.cyan, marginLeft: 4 }}>▍</span>
          </div>
        </div>
        <div style={{ marginTop: 28, display: "flex", justifyContent: "space-between", color: COLORS.dim, fontFamily: "JetBrains Mono, monospace", fontSize: 22 }}>
          <span>tokens: <span style={{ color: COLORS.cyan }}>{chars}</span></span>
          <span>velocidade: <span style={{ color: COLORS.cyan }}>1.4k/s</span></span>
          <span style={{ color: chars >= FULL.length ? COLORS.cyan : COLORS.dim }}>
            {chars >= FULL.length ? "✓ otimizado" : "gerando..."}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
