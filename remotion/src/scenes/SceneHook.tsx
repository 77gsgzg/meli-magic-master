import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { RuxovLogo } from "../components/RuxovLogo";
import { COLORS } from "../theme";

export const SceneHook: React.FC = () => {
  const f = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const scale = spring({ frame: f, fps, config: { damping: 12, stiffness: 110, mass: 1 } });
  const pulse = 0.8 + 0.4 * (0.5 + 0.5 * Math.sin(f / 6));
  const sweep = interpolate(f, [10, 70], [-width, width], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const subOp = interpolate(f, [40, 60], [0, 1], { extrapolateRight: "clamp" });
  const subY = interpolate(f, [40, 60], [20, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 40 }}>
      <div style={{ transform: `scale(${0.4 + scale * 0.6})`, position: "relative", overflow: "hidden", padding: 40 }}>
        <RuxovLogo size={260} glow={pulse} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 220,
            height: "100%",
            transform: `translateX(${sweep}px) skewX(-20deg)`,
            background: `linear-gradient(90deg, transparent, ${COLORS.white}aa, transparent)`,
            mixBlendMode: "screen",
            filter: "blur(8px)",
          }}
        />
      </div>
      <div
        style={{
          opacity: subOp,
          transform: `translateY(${subY}px)`,
          color: COLORS.dim,
          fontFamily: "Inter, sans-serif",
          fontSize: 32,
          letterSpacing: 8,
          textTransform: "uppercase",
        }}
      >
        IA · Mercado Livre · Ecosystem
      </div>
    </AbsoluteFill>
  );
};
