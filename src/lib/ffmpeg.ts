import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

/** Runs the bundled ffmpeg with `args`; rejects with its error output if it fails or runs past `timeoutMs`. */
export function runFfmpeg(args: string[], timeoutMs = 120_000) {
  return new Promise<void>((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg is not available on this server"));
    const child = spawn(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += String(d).slice(0, 2000)));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ffmpeg took too long"));
    }, timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed (${code}): ${stderr.trim().slice(0, 300)}`));
    });
  });
}

/** Width and height of the first picture stream in a video or image file, read from ffmpeg's description of it. */
export function probeSize(path: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg is not available on this server"));
    // With no output file ffmpeg only describes the input (and exits with an error code, which is expected).
    const child = spawn(ffmpegPath, ["-hide_banner", "-i", path], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += String(d)));
    child.on("error", reject);
    child.on("close", () => {
      const m = /Stream #.*Video:.*?(\d{2,5})x(\d{2,5})/.exec(stderr);
      if (m) resolve({ width: Number(m[1]), height: Number(m[2]) });
      else reject(new Error("could not read the picture size"));
    });
  });
}
