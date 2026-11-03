"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { formatRupees } from "@/lib/game";
import {
  BOARDS,
  formatBoardValue,
  podiumColor,
  rankDevelopers,
  type Board,
} from "@/lib/leaderboard";
import type { Developer } from "@/lib/seed";
import { BILLBOARD } from "@/lib/buildings";

/**
 * Three rows on the board itself, not five: at town-furniture scale only the
 * podium is legible from the street. The popup carries the full standings.
 */
const ROWS = 3;
const BOARD_W = BILLBOARD.width;
const BOARD_H = BILLBOARD.height;
/** Texture pixels per world unit. High, because the board itself is small. */
const DPU = 900;

/**
 * Draw the standings onto a canvas.
 *
 * A canvas texture rather than 3D text: no font file to load, no CSP-allowlisted
 * CDN, and the whole board is one draw call. Redrawn only when the data or the
 * board changes.
 */
function useBoardTexture(developers: Developer[], board: Board, releaseName: string) {
  const texture = useMemo(() => {
    const width = Math.round(BOARD_W * DPU);
    const height = Math.round(BOARD_H * DPU);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    // The layout below is authored against a 660px-tall design and scaled.
    const scale = height / 660;

    // Board
    ctx.fillStyle = "#17120c";
    ctx.fillRect(0, 0, width, height);
    const grain = ctx.createLinearGradient(0, 0, 0, height);
    grain.addColorStop(0, "rgba(255,255,255,0.05)");
    grain.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#4a3526";
    ctx.lineWidth = 14 * scale;
    ctx.strokeRect(7 * scale, 7 * scale, width - 14 * scale, height - 14 * scale);

    const pad = 44 * scale;
    const title = BOARDS.find((b) => b.id === board)?.short ?? "Standings";

    // Header
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#e3b341";
    ctx.font = `bold ${44 * scale}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(title.toUpperCase(), pad, 56 * scale);
    ctx.textAlign = "right";
    ctx.fillStyle = "#8b949e";
    ctx.font = `${30 * scale}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(`RELEASE ${releaseName}`, width - pad, 56 * scale);

    ctx.strokeStyle = "rgba(227,179,65,0.4)";
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.moveTo(pad, 92 * scale);
    ctx.lineTo(width - pad, 92 * scale);
    ctx.stroke();

    // Rows
    const ranked = rankDevelopers(developers, board).slice(0, ROWS);
    const top = ranked[0]?.value || 1;
    const rowH = 132 * scale;
    ranked.forEach((entry, i) => {
      const y = 168 * scale + i * rowH;
      const medal = podiumColor(entry.rank);

      // A faint bar behind each name, proportional to their score.
      ctx.fillStyle = medal ? `${medal}22` : "rgba(255,255,255,0.05)";
      const barW = (width - pad * 2) * Math.max(0.08, entry.value / top);
      ctx.fillRect(pad, y - 34 * scale, barW, 68 * scale);

      ctx.textAlign = "left";
      ctx.fillStyle = medal ?? "#6e7681";
      ctx.font = `bold ${40 * scale}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(`${entry.rank}`, pad + 14 * scale, y);

      ctx.fillStyle = "#e6edf3";
      ctx.font = `${medal ? "bold " : ""}${38 * scale}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(entry.developer.name, pad + 74 * scale, y);

      ctx.textAlign = "right";
      ctx.fillStyle = medal ?? "#c9d1d9";
      ctx.font = `bold ${36 * scale}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(formatBoardValue(entry.value, board), width - pad - 14 * scale, y);

      ctx.fillStyle = "#6e7681";
      ctx.font = `${24 * scale}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(formatRupees(entry.developer.wallet), width - pad - 14 * scale, y + 32 * scale);
    });

    ctx.textAlign = "center";
    ctx.fillStyle = "#6e7681";
    ctx.font = `${24 * scale}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText("click for all standings", width / 2, height - 30 * scale);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, [developers, board, releaseName]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/**
 * The notice board in the square: the standings, posted where everyone walks
 * past. Frame is built from primitives — a board, two posts and a beam — since
 * the village pack has no signboard and this is a dozen lines.
 */
export function Billboard({
  developers,
  board,
  releaseName,
  position,
  rotation = 0,
  onClick,
}: {
  developers: Developer[];
  board: Board;
  releaseName: string;
  position: [number, number, number];
  rotation?: number;
  onClick: () => void;
}) {
  const texture = useBoardTexture(developers, board, releaseName);
  const lamp = useRef<THREE.PointLight>(null);

  // A lantern over the board, flickering just enough to look lit rather than
  // emissive — the standings should read at night.
  useFrame(({ clock }) => {
    if (lamp.current) {
      lamp.current.intensity = 1.4 + Math.sin(clock.elapsedTime * 2.3) * 0.25;
    }
  });

  const postH = BILLBOARD.post;
  const centreY = postH + BOARD_H / 2;

  return (
    <group
      position={position}
      rotation={[0, rotation, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (BOARD_W / 2 - 0.09), postH / 2, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.045, postH, 8]} />
          <meshStandardMaterial color="#4a3526" roughness={0.9} />
        </mesh>
      ))}

      <mesh position={[0, centreY, 0]} castShadow receiveShadow>
        <boxGeometry args={[BOARD_W, BOARD_H, BILLBOARD.depth]} />
        <meshStandardMaterial color="#2a1f16" roughness={0.85} />
      </mesh>

      {/* The standings themselves, just proud of the board's front face. */}
      <mesh position={[0, centreY, BILLBOARD.depth / 2 + 0.004]}>
        <planeGeometry args={[BOARD_W - 0.05, BOARD_H - 0.05]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>

      <mesh position={[0, centreY + BOARD_H / 2 + BILLBOARD.beam / 2, 0]} castShadow>
        <boxGeometry args={[BOARD_W + 0.12, BILLBOARD.beam, 0.14]} />
        <meshStandardMaterial color="#4a3526" roughness={0.9} />
      </mesh>

      <mesh position={[0, centreY + BOARD_H / 2 + BILLBOARD.beam + 0.03, 0.1]}>
        <sphereGeometry args={[0.04, 10, 8]} />
        <meshStandardMaterial
          color="#ffe6a8"
          emissive="#ffd479"
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
      <pointLight ref={lamp} position={[0, centreY + 0.2, 0.35]} color="#ffd479" intensity={1.4} distance={2.6} />
    </group>
  );
}
