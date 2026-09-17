/**
 * Task 6-b QA #2: real speech (TTS) through /api/notes/voice.
 * - short speech WAV → expect 201 + sensible transcription
 * - long speech WAV (>30 s, PCM repeated) → expect segmentation → 201 + joined text
 * Run: bun tool-results/6b/s2b-speech-route-test.ts
 */
import { readFileSync, writeFileSync } from "fs";

const BASE = "http://localhost:3000";
const EMAIL = `s2b-api2-${Date.now()}@vf.io`;
const PASSWORD = "Test12345!";

function toBase64(buf: Buffer): string {
  return buf.toString("base64");
}

/** Read PCM payload + fmt info from a WAV, then rebuild with N repeats. */
function repeatWav(input: Buffer, repeats: number): Buffer {
  let off = 12;
  let fmt: { channels: number; sampleRate: number; bits: number } | null = null;
  let dataStart = -1;
  let dataLength = 0;
  while (off + 8 <= input.length) {
    const id = input.toString("ascii", off, off + 4);
    const size = input.readUInt32LE(off + 4);
    if (id === "fmt ") {
      fmt = {
        channels: input.readUInt16LE(off + 10),
        sampleRate: input.readUInt32LE(off + 12),
        bits: input.readUInt16LE(off + 22),
      };
    } else if (id === "data") {
      dataStart = off + 8;
      dataLength = Math.min(size, input.length - dataStart);
      break;
    }
    off += 8 + size + (size % 2);
  }
  if (!fmt || dataStart < 0) throw new Error("bad wav");
  const blockAlign = (fmt.bits / 8) * fmt.channels;
  const data = input.subarray(dataStart, dataStart + dataLength);
  const out = Buffer.alloc(44 + data.length * repeats);
  out.write("RIFF", 0, "ascii");
  out.writeUInt32LE(36 + data.length * repeats, 4);
  out.write("WAVE", 8, "ascii");
  out.write("fmt ", 12, "ascii");
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(fmt.channels, 22);
  out.writeUInt32LE(fmt.sampleRate, 24);
  out.writeUInt32LE(fmt.sampleRate * blockAlign, 28);
  out.writeUInt16LE(blockAlign, 32);
  out.writeUInt16LE(fmt.bits, 34);
  out.write("data", 36, "ascii");
  out.writeUInt32LE(data.length * repeats, 40);
  for (let i = 0; i < repeats; i++) data.copy(out, 44 + i * data.length);
  return out;
}

const reg = await fetch(`${BASE}/api/auth/register`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "S2B API2 QA", email: EMAIL, password: PASSWORD }),
});
const cookie = reg.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
console.log("register:", reg.status, "email:", EMAIL);

async function postVoice(buf: Buffer, label: string) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/notes/voice`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ audioBase64: toBase64(buf), mime: "audio/wav" }),
  });
  const body: any = await res.json().catch(() => ({}));
  console.log(`\n[${label}] ${res.status} in ${Date.now() - t0}ms`);
  console.log("  rawText:", JSON.stringify(body?.note?.rawText ?? body?.error));
  console.log("  status:", body?.note?.status, "transcription:", JSON.stringify(body?.note?.transcription));
  return body?.note;
}

const speech = readFileSync(new URL("./s2b-speech.wav", import.meta.url));
console.log("speech.wav:", speech.length, "bytes, ~", (speech.length / 48000).toFixed(1), "s");

// 1. Short real speech (~14 s) → expect 201
await postVoice(speech, "short speech 14s");

// 2. Long speech (~58 s = 4 repeats) → segmentation → expect 201 + joined text
const long = repeatWav(speech, 4);
console.log("long.wav:", long.length, "bytes, ~", (long.length / 48000).toFixed(1), "s");
await postVoice(long, "long speech 58s (segmented)");

writeFileSync(new URL("./s2b-api2-user.txt", import.meta.url), `${EMAIL}\n${PASSWORD}`);
console.log("\nsaved test user creds");
