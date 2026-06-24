import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

export const Grain: React.FC = () => {
  const f = useCurrentFrame();
  const seed = (f * 9301 + 49297) % 233280;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        mixBlendMode: "overlay",
        opacity: 0.18,
        backgroundImage:
          `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='2' seed='${seed}'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
        backgroundSize: "240px 240px",
      }}
    />
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background:
        "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.65) 100%)",
    }}
  />
);

export const Scanlines: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      opacity: 0.06,
      backgroundImage:
        "repeating-linear-gradient(0deg, rgba(255,255,255,0.4) 0 1px, transparent 1px 3px)",
    }}
  />
);
