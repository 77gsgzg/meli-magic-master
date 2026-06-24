import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";

export const SceneGenerator: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 18 } });
  const rot = interpolate(enter, [0, 1], [-15, 0]);
  const op = interpolate(f, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const scanY = interpolate(f, [10, 70], [0, 100], { extrapolateRight: "clamp" });
  const reveal = interpolate(f, [60, 100], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 1600 }}>
      <div style={{ opacity: op, transform: `rotateY(${rot}deg)`, width: 820 }}>
        <div style={{ color: COLORS.dim, fontFamily: "JetBrains Mono, monospace", fontSize: 22, letterSpacing: 2, marginBottom: 20 }}>
          // IMAGE GENERATION · INPAINT
        </div>
        <div
          style={{
            position: "relative",
            aspectRatio: "1/1",
            borderRadius: 32,
            overflow: "hidden",
            border: `2px solid ${COLORS.cyan}50`,
            boxShadow: `0 20px 100px ${COLORS.blue}50, 0 0 0 1px ${COLORS.cyan}30 inset`,
            background: COLORS.bgSoft,
          }}
        >
          {/* Placeholder product silhouette */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(circle at 50% 55%, ${COLORS.blue}50 0%, transparent 55%), linear-gradient(135deg, #1a2030, #0d0e12)`,
            }}
          />
          <svg viewBox="0 0 200 200" style={{ position: "absolute", inset: "20%", filter: `drop-shadow(0 0 30px ${COLORS.cyan})`, opacity: reveal * 0.5 + 0.5 }}>
            <rect x="50" y="40" width="100" height="130" rx="14" fill="none" stroke={COLORS.cyan} strokeWidth="3" />
            <circle cx="100" cy="100" r="28" fill="none" stroke={COLORS.blue} strokeWidth="3" />
            <line x1="60" y1="150" x2="140" y2="150" stroke={COLORS.cyan} strokeWidth="3" />
          </svg>

          {/* Scan line */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${scanY}%`,
              height: 6,
              background: `linear-gradient(90deg, transparent, ${COLORS.cyan}, transparent)`,
              boxShadow: `0 0 30px ${COLORS.cyan}`,
            }}
          />
          {/* Scan trail */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: `${scanY}%`,
              background: `linear-gradient(180deg, transparent, ${COLORS.cyan}20)`,
            }}
          />
          {/* Corner markers */}
          {[[10,10],[10,90,true],[90,10],[90,90,true,true]].map((c,i)=>(
            <div key={i} style={{position:"absolute",left:`${c[0]}%`,top:`${c[1]}%`,width:40,height:40,borderTop:`3px solid ${COLORS.cyan}`,borderLeft:`3px solid ${COLORS.cyan}`,transform:`translate(-50%,-50%) rotate(${i*90}deg)`}}/>
          ))}
        </div>
        <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", color: COLORS.dim, fontFamily: "JetBrains Mono, monospace", fontSize: 20 }}>
          <span>analyzing pixels...</span>
          <span style={{ color: COLORS.cyan }}>{Math.floor(interpolate(f, [10, 90], [0, 100], { extrapolateRight: "clamp" }))}%</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
