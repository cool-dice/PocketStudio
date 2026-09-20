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
});
