/**
 * Task 6-b QA: generate sine WAVs (16 kHz mono PCM16) and POST them to
 * /api/notes/voice to verify the REST route (statuses, no 500s).
 * Run: bun tool-results/6b/s2b-voice-route-test.ts
 */
import { writeFileSync } from "fs";

const BASE = "http://localhost:3000";
const EMAIL = `s2b-api-${Date.now()}@vf.io`;
const PASSWORD = "Test12345!";

function makeWavBase64(seconds: number, freq = 220): string {
  const rate = 16000;
  const n = Math.floor(rate * seconds);
  const bytes = new Uint8Array(44 + n * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.sin((2 * Math.PI * freq * i) / rate) * 0.3;
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// 1. Register → session cookie
const reg = await fetch(`${BASE}/api/auth/register`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "S2B API QA", email: EMAIL, password: PASSWORD }),
});
const cookie = reg.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
console.log("register:", reg.status, "email:", EMAIL);

async function postVoice(seconds: number) {
  const audioBase64 = makeWavBase64(seconds);
  const res = await fetch(`${BASE}/api/notes/voice`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ audioBase64, mime: "audio/wav" }),
  });
  const body = await res.json().catch(() => ({}));
  console.log(
    `POST voice (${seconds}s sine, ${(audioBase64.length / 1024).toFixed(0)}KB b64):`,
    res.status,
    JSON.stringify(body).slice(0, 300),
  );
  return { status: res.status, body };
}

// Unauthenticated check
const noAuth = await fetch(`${BASE}/api/notes/voice`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ audioBase64: makeWavBase64(0.5), mime: "audio/wav" }),
});
console.log("POST voice (no auth):", noAuth.status, await noAuth.text());

// Bad body checks
const bad1 = await fetch(`${BASE}/api/notes/voice`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ audioBase64: "", mime: "audio/wav" }),
});
console.log("POST voice (empty b64):", bad1.status, await bad1.text());
const bad2 = await fetch(`${BASE}/api/notes/voice`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ audioBase64: "AAAA", mime: "video/mp4" }),
});
console.log("POST voice (bad mime):", bad2.status, await bad2.text());

// Duration sweep against the ASR service limit
await postVoice(0.5);
await postVoice(25);
await postVoice(31);
await postVoice(40);

writeFileSync("/home/z/my-project/tool-results/6b/s2b-api-user.txt", `${EMAIL}\n${PASSWORD}`);
console.log("saved test user to tool-results/6b/s2b-api-user.txt");
