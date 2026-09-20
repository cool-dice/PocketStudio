import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function whichFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("ffmpeg", ["-version"], { stdio: ["ignore", "pipe", "pipe"] });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

export interface FfmpegScene {
  imagePath: string;
  audioPath?: string | null;
  durationSec: number;
}

function run(args: string[], cwd?: string): Promise<{ ok: boolean; log: string }> {
  return new Promise((resolve) => {
    const child = spawn("ffmpeg", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    child.stdout.on("data", (d) => {
      log += String(d);
    });
    child.stderr.on("data", (d) => {
      log += String(d);
    });
    child.on("error", (err) => resolve({ ok: false, log: err.message }));
    child.on("close", (code) => resolve({ ok: code === 0, log }));
  });
}

/**
 * Concat stills (+ optional audio) into a WebM via ffmpeg.
 * Falls back to stills-only if a scene audio file is missing.
 */
export async function compileFilmFfmpeg(
  scenes: FfmpegScene[],
  outputPath: string,
): Promise<{ ok: boolean; log: string }> {
  if (scenes.length === 0) {
    return { ok: false, log: "Нет сцен для сборки" };
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ps-film-"));
  try {
    const listPath = path.join(tmp, "list.txt");
    const lines: string[] = [];
    for (const scene of scenes) {
      const dur = Math.max(1, Math.min(30, scene.durationSec || 4));
      const abs = path.resolve(scene.imagePath);
      lines.push(`file '${abs.replace(/'/g, "'\\''")}'`);
      lines.push(`duration ${dur}`);
    }
    lines.push(`file '${path.resolve(scenes[scenes.length - 1]!.imagePath).replace(/'/g, "'\\''")}'`);
    fs.writeFileSync(listPath, lines.join("\n"));

    const result = await run([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-vf",
      "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
      "-r",
      "24",
      "-c:v",
      "libvpx-vp9",
      "-b:v",
      "1M",
      "-an",
      outputPath,
    ]);
    return result;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
