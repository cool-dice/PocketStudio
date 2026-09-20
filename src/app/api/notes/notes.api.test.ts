import { describe, expect, test } from "bun:test";

import {
  JSON_BODY_LIMIT,
  JSON_BODY_TOO_LARGE,
} from "@/lib/json-body-limit";

import { POST as createNote } from "./route";

function notesPost(contentLength: number, body = "{}"): Request {
  return new Request("http://localhost/api/notes", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "content-length": String(contentLength),
    },
    body,
  });
}

function notesPostChunked(body: string, contentLength?: string): Request {
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
  });
  if (contentLength != null) headers.set("content-length", contentLength);
  const bytes = new TextEncoder().encode(body);
  return new Request("http://localhost/api/notes", {
    method: "POST",
    headers,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  });
}

describe("POST /api/notes JSON body limit", () => {
  test("huge Content-Length is 413 Russian before auth or parse", async () => {
    const res = await createNote(notesPost(JSON_BODY_LIMIT + 1));
    expect(res.status).toBe(413);
    const json = (await res.json()) as { error?: string; note?: unknown };
    expect(json.note).toBeUndefined();
    expect(json.error).toContain(JSON_BODY_TOO_LARGE);
    expect(json.error).toMatch(/256\s*КБ/);
  });

  test("Content-Length at the cap is not 413", async () => {
    const res = await createNote(notesPost(JSON_BODY_LIMIT));
    expect(res.status).not.toBe(413);
    expect(res.status).toBe(401);
  });

  test("chunked body over 256 KB without Content-Length is 413 Russian", async () => {
    const res = await createNote(
      notesPostChunked("x".repeat(JSON_BODY_LIMIT + 1)),
    );
    expect(res.status).toBe(413);
    const json = (await res.json()) as { error?: string; note?: unknown };
    expect(json.note).toBeUndefined();
    expect(json.error).toContain(JSON_BODY_TOO_LARGE);
    expect(json.error).toMatch(/256\s*КБ/);
  });

  test("Content-Length smaller than the real body is 413 while reading", async () => {
    const res = await createNote(
      notesPostChunked("x".repeat(JSON_BODY_LIMIT + 1), "10"),
    );
    expect(res.status).toBe(413);
    const json = (await res.json()) as { error?: string; note?: unknown };
    expect(json.note).toBeUndefined();
    expect(json.error).toContain(JSON_BODY_TOO_LARGE);
  });
});
