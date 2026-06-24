import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { PersistentBackground } from "./components/PersistentBackground";
import { Grain, Vignette, Scanlines } from "./components/FilmFX";
import { SceneHook } from "./scenes/SceneHook";
import { SceneDashboard } from "./scenes/SceneDashboard";
import { SceneGenerator } from "./scenes/SceneGenerator";
import { SceneHeatmap } from "./scenes/SceneHeatmap";
import { SceneTyping } from "./scenes/SceneTyping";
import { SceneClosing } from "./scenes/SceneClosing";

loadInter("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] });
loadMono("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

// Hard cut flash between scenes
const FlashCut: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame();
  const op = interpolate(f, [at - 2, at, at + 6], [0, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (op <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #11d4c4, #06a8f9)",
        mixBlendMode: "screen",
        opacity: op,
        pointerEvents: "none",
      }}
    />
  );
};

const ChromaticBorder: React.FC = () => {
  const f = useCurrentFrame();
  const intensity = 1 + 0.5 * Math.sin(f / 11);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", opacity: 0.35 }}>
      <AbsoluteFill style={{ boxShadow: `inset ${4 * intensity}px 0 0 #ff003a, inset -${4 * intensity}px 0 0 #00f0ff` }} />
    </AbsoluteFill>
  );
};

export const MainVideo: React.FC = () => {
  // Scene timeline (frames):
  // Hook 0-90, Dashboard 90-210, Generator 210-330, Heatmap 330-450,
  // Typing 450-750, Closing 750-1050
  const cuts = [90, 210, 330, 450, 750];
  return (
    <AbsoluteFill style={{ background: "#0d0e12" }}>
      <PersistentBackground />

      <Sequence from={0} durationInFrames={90}><SceneHook /></Sequence>
      <Sequence from={90} durationInFrames={120}><SceneDashboard /></Sequence>
      <Sequence from={210} durationInFrames={120}><SceneGenerator /></Sequence>
      <Sequence from={330} durationInFrames={120}><SceneHeatmap /></Sequence>
      <Sequence from={450} durationInFrames={300}><SceneTyping /></Sequence>
      <Sequence from={750} durationInFrames={300}><SceneClosing /></Sequence>

      {cuts.map((c) => <FlashCut key={c} at={c} />)}

      <Scanlines />
      <ChromaticBorder />
      <Vignette />
      <Grain />
    </AbsoluteFill>
  );
};
