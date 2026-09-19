import { spawn } from "node:child_process";

export type DockerPresence = "ok" | "no-cli" | "no-daemon";

function looksLikeMissingDaemon(text: string): boolean {
  return /cannot connect|daemon|Is the docker daemon running|pipe/i.test(text);
}

/** Probe docker CLI + daemon. Never invent a healthy daemon. */
export function whichDocker(): Promise<DockerPresence> {
  return new Promise((resolve) => {
    const child = spawn(
      "docker",
      ["version", "--format", "{{.Server.Version}}"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => {
      out += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      err += String(chunk);
    });
    child.on("error", () => resolve("no-cli"));
    child.on("close", (code) => {
      if (code === 0 && out.trim()) {
        resolve("ok");
        return;
      }
      if (looksLikeMissingDaemon(`${out}\n${err}`)) {
        resolve("no-daemon");
        return;
      }
      resolve(code === null ? "no-cli" : "no-daemon");
    });
  });
}

export function runDockerBuild(
  root: string,
  tag: string,
): Promise<{ ok: boolean; log: string }> {
  return new Promise((resolve) => {
    const child = spawn("docker", ["build", "-t", tag, "."], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let buf = "";
    child.stdout.on("data", (chunk) => {
      buf += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      buf += String(chunk);
    });
    child.on("error", (error) => resolve({ ok: false, log: error.message }));
    child.on("close", (code) =>
      resolve({ ok: code === 0, log: buf.slice(-8_000) }),
    );
  });
}
