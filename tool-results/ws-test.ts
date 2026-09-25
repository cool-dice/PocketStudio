// Direct WS test client: connects to agent-service :3003, sends an act-mode
// work request to a thread, and logs ALL events (incl. new turn:phase /
// tasks:updated). Usage: bun run ws-test.ts <email> <password> <threadId> <message>
import { io } from "socket.io-client";

const [, , email, password, threadId, message] = process.argv;

async function main() {
  // 1. Login via REST → session cookie.
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = (loginRes.headers.get("set-cookie") ?? "").split(";")[0];
  console.log("[login]", loginRes.status, email);

  // 2. WS token.
  const tokenRes = await fetch("http://localhost:3000/api/auth/ws-token", {
    headers: { cookie },
  });
  const { token } = (await tokenRes.json()) as { token: string };
  console.log("[ws-token]", tokenRes.status);

  // 3. Socket.io client (same transport the frontend uses).
  const socket = io("http://localhost:3003", {
    path: "/socket.io",
    auth: { token },
    transports: ["polling", "websocket"],
  });

  const events: string[] = [];
  socket.on("connect", () => {
    console.log("[ws] connected", socket.id);
    socket.emit("thread:join", { threadId });
    console.log("[send]", message);
    socket.emit("message:send", { threadId, content: message });
  });
  socket.on("connect_error", (e: Error) => console.log("[ws] connect_error:", e.message));
  socket.on("error", (p: unknown) => console.log("[error]", JSON.stringify(p)));

  for (const name of [
    "message:user",
    "agent:thinking",
    "turn:phase",
    "tasks:updated",
    "tool:start",
    "tool:end",
    "message:start",
    "message:delta",
    "message:end",
    "thread:updated",
    "project:created",
    "project:updated",
    "notification:new",
  ]) {
    socket.on(name, (payload: unknown) => {
      const p = payload as Record<string, unknown>;
      if (name === "message:delta") {
        process.stdout.write((p.delta as string) ?? "");
        return;
      }
      let brief = JSON.stringify(p);
      if (brief && brief.length > 400) brief = `${brief.slice(0, 400)}…`;
      console.log(`\n[${name}]`, brief);
      events.push(name);
    });
  }

  // Exit after 170s of runtime or 20s after the final message.
  let done = 0;
  const timer = setInterval(() => {
    done += 5;
    if (done >= 170 || (events.includes("message:end") && done >= 20)) {
      console.log("\n[summary]", JSON.stringify(events));
      clearInterval(timer);
      socket.close();
      process.exit(0);
    }
  }, 5000);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
