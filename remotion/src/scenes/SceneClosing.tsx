import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { RuxovLogo } from "../components/RuxovLogo";
import { COLORS } from "../theme";

export const SceneClosing: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Orbiting feature pills zoom out then resolve into logo + CTA
  const zoomOut = interpolate(f, [0, 80], [2.2, 1], { extrapolateRight: "clamp" });
  const logoSpring = spring({ frame: f - 50, fps, config: { damping: 14 } });
  const logoScale = interpolate(logoSpring, [0, 1], [0.4, 1]);
  const logoOp = interpolate(f, [50, 80], [0, 1], { extrapolateRight: "clamp" });
  const ctaOp = interpolate(f, [140, 180], [0, 1], { extrapolateRight: "clamp" });
  const ctaScale = spring({ frame: f - 140, fps, config: { damping: 12 } });
  const ctaPulse = 1 + 0.04 * Math.sin(f / 7);
  const domainOp = interpolate(f, [200, 240], [0, 1], { extrapolateRight: "clamp" });

  const features = [
    { label: "Dashboard IA", a: 0 },
    { label: "Heatmap", a: 60 },
    { label: "Inpaint", a: 120 },
    { label: "Copy IA", a: 180 },
    { label: "TikTok Miner", a: 240 },
    { label: "Wallet", a: 300 },
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {/* Orbiting features */}
      <div style={{ position: "absolute", transform: `scale(${zoomOut})` }}>
        {features.map((feat, i) => {
          const angle = (feat.a + f * 0.4) * (Math.PI / 180);
          const r = 380;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          const op = interpolate(f, [0, 40], [0, 0.9], { extrapolateRight: "clamp" }) *
            interpolate(f, [180, 240], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                transform: "translate(-50%, -50%)",
                padding: "14px 28px",
                borderRadius: 999,
                border: `1px solid ${COLORS.cyan}60`,
                background: `${COLORS.bgSoft}cc`,
                color: COLORS.white,
                fontFamily: "Inter, sans-serif",
                fontSize: 26,
                fontWeight: 600,
                opacity: op,
                boxShadow: `0 0 30px ${COLORS.cyan}40`,
                whiteSpace: "nowrap",
              }}
            >
              {feat.label}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 60 }}>
        <div style={{ opacity: logoOp, transform: `scale(${logoScale})` }}>
          <RuxovLogo size={300} glow={1.2} />
        </div>

        <div
          style={{
            opacity: ctaOp,
            transform: `scale(${0.7 + ctaScale * 0.3}) scale(${ctaPulse})`,
            padding: "32px 72px",
            borderRadius: 24,
            background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.blue})`,
            color: "#001018",
            fontFamily: "Inter, sans-serif",
            fontWeight: 800,
            fontSize: 56,
            letterSpacing: -1,
            boxShadow: `0 30px 80px ${COLORS.cyan}80, 0 0 100px ${COLORS.blue}80, inset 0 -8px 0 rgba(0,0,0,0.18)`,
            textTransform: "uppercase",
          }}
        >
          Conheça o Ruxov
        </div>

        <div
          style={{
            opacity: domainOp,
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 38,
            color: COLORS.cyan,
            letterSpacing: 2,
            textShadow: `0 0 20px ${COLORS.cyan}80`,
          }}
        >
          ruxov.com.br
        </div>
      </div>
    </AbsoluteFill>
  );
};
