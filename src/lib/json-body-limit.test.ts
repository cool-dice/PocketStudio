import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";

import { proxy } from "@/proxy";

import {
  JSON_BODY_LIMIT,
  JSON_BODY_LIMIT_DESIGN,
  JSON_BODY_LIMIT_LARGE,
  JSON_BODY_LIMIT_MEDIA,
  JSON_BODY_TOO_LARGE,
  contentLengthBytes,
  formatJsonBodyLimit,
  isJsonBodyMethod,
  jsonBodyLimitBytes,
  jsonBodyTooLargeMessage,
  oversizedJsonResponse,
} from "./json-body-limit";

function jsonReq(
  url: string,
  length: number,
  init?: { method?: string; contentType?: string; body?: string },
): Request {
  const headers = new Headers({
    "content-type": init?.contentType ?? "application/json",
    "content-length": String(length),
  });
  return new Request(url, {
    method: init?.method ?? "POST",
    headers,
    body: init?.body ?? "{}",
  });
}

describe("json body limits", () => {
  test("most JSON routes cap at 256 KB", () => {
    expect(jsonBodyLimitBytes("/api/notes")).toBe(JSON_BODY_LIMIT);
    expect(jsonBodyLimitBytes("/api/auth/login")).toBe(JSON_BODY_LIMIT);
    expect(jsonBodyLimitBytes("/api/workspaces")).toBe(JSON_BODY_LIMIT);
    expect(JSON_BODY_LIMIT).toBe(256 * 1024);
  });

  test("file / chapter / DAW / NLE get 1 MB", () => {
    expect(jsonBodyLimitBytes("/api/projects/abc/file")).toBe(
      JSON_BODY_LIMIT_LARGE,
    );
    expect(jsonBodyLimitBytes("/api/sections/ch1")).toBe(JSON_BODY_LIMIT_LARGE);
    expect(jsonBodyLimitBytes("/api/workspaces/w1/daw")).toBe(
      JSON_BODY_LIMIT_LARGE,
    );
    expect(jsonBodyLimitBytes("/api/workspaces/w1/timeline")).toBe(
      JSON_BODY_LIMIT_LARGE,
    );
    expect(JSON_BODY_LIMIT_LARGE).toBe(1024 * 1024);
  });

  test("design preview data-URL gets 3 MB", () => {
    expect(jsonBodyLimitBytes("/api/workspaces/w1/design")).toBe(
      JSON_BODY_LIMIT_DESIGN,
    );
  });

  test("voice and binary upload get 36 MB", () => {
    expect(jsonBodyLimitBytes("/api/notes/voice")).toBe(JSON_BODY_LIMIT_MEDIA);
    expect(jsonBodyLimitBytes("/api/workspaces/w1/upload")).toBe(
      JSON_BODY_LIMIT_MEDIA,
    );
  });

  test("multipart zip is skipped (own 20 MB cap)", () => {
    expect(
      jsonBodyLimitBytes("/api/projects", "multipart/form-data; boundary=x"),
    ).toBeNull();
  });

  test("Russian 413 copy names the cap", () => {
    expect(formatJsonBodyLimit(JSON_BODY_LIMIT)).toBe("256 КБ");
    expect(formatJsonBodyLimit(JSON_BODY_LIMIT_LARGE)).toBe("1 МБ");
    expect(jsonBodyTooLargeMessage(JSON_BODY_LIMIT)).toContain(
      JSON_BODY_TOO_LARGE,
    );
    expect(jsonBodyTooLargeMessage(JSON_BODY_LIMIT)).toContain("256 КБ");
  });

  test("only POST/PUT/PATCH are gated", () => {
    expect(isJsonBodyMethod("POST")).toBe(true);
    expect(isJsonBodyMethod("put")).toBe(true);
    expect(isJsonBodyMethod("PATCH")).toBe(true);
    expect(isJsonBodyMethod("GET")).toBe(false);
    expect(isJsonBodyMethod("DELETE")).toBe(false);
  });

  test("missing or invalid Content-Length is not 413", () => {
    expect(contentLengthBytes(new Headers())).toBeNull();
    expect(contentLengthBytes(new Headers({ "content-length": "nope" }))).toBeNull();
    const req = new Request("http://localhost/api/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(oversizedJsonResponse(req)).toBeNull();
  });
});

describe("oversizedJsonResponse", () => {
  test("notes POST over 256 KB is 413 Russian", async () => {
    const res = oversizedJsonResponse(
      jsonReq("http://localhost/api/notes", JSON_BODY_LIMIT + 1),
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(413);
    const json = (await res!.json()) as { error: string };
    expect(json.error).toContain(JSON_BODY_TOO_LARGE);
    expect(json.error).toMatch(/256\s*КБ/);
  });

  test("notes POST at the cap is not 413", () => {
    expect(
      oversizedJsonResponse(
        jsonReq("http://localhost/api/notes", JSON_BODY_LIMIT),
      ),
    ).toBeNull();
  });

  test("GET is not gated even with a huge Content-Length", () => {
    expect(
      oversizedJsonResponse(
        jsonReq("http://localhost/api/notes", JSON_BODY_LIMIT + 1, {
          method: "GET",
        }),
      ),
    ).toBeNull();
  });

  test("HTML routes are not gated", () => {
    expect(
      oversizedJsonResponse(
        jsonReq("http://localhost/login", JSON_BODY_LIMIT + 1),
      ),
    ).toBeNull();
  });

  test("voice under media cap is not 413", () => {
    expect(
      oversizedJsonResponse(
        jsonReq("http://localhost/api/notes/voice", JSON_BODY_LIMIT + 1),
      ),
    ).toBeNull();
    expect(
      oversizedJsonResponse(
        jsonReq("http://localhost/api/notes/voice", JSON_BODY_LIMIT_MEDIA),
      ),
    ).toBeNull();
  });

  test("voice over media cap is 413", async () => {
    const res = oversizedJsonResponse(
      jsonReq("http://localhost/api/notes/voice", JSON_BODY_LIMIT_MEDIA + 1),
    );
    expect(res!.status).toBe(413);
    const json = (await res!.json()) as { error: string };
    expect(json.error).toContain(JSON_BODY_TOO_LARGE);
  });

  test("file PUT 256 KB+1 is allowed; 1 MB+1 is 413", () => {
    expect(
      oversizedJsonResponse(
        jsonReq("http://localhost/api/projects/p1/file", JSON_BODY_LIMIT + 1, {
          method: "PUT",
        }),
      ),
    ).toBeNull();
    expect(
      oversizedJsonResponse(
        jsonReq(
          "http://localhost/api/projects/p1/file",
          JSON_BODY_LIMIT_LARGE + 1,
          { method: "PUT" },
        ),
      )?.status,
    ).toBe(413);
  });

  test("design PUT 1 MB+1 is allowed; 3 MB+1 is 413", () => {
    expect(
      oversizedJsonResponse(
        jsonReq(
          "http://localhost/api/workspaces/w1/design",
          JSON_BODY_LIMIT_LARGE + 1,
          { method: "PUT" },
        ),
      ),
    ).toBeNull();
    expect(
      oversizedJsonResponse(
        jsonReq(
          "http://localhost/api/workspaces/w1/design",
          JSON_BODY_LIMIT_DESIGN + 1,
          { method: "PUT" },
        ),
      )?.status,
    ).toBe(413);
  });

  test("multipart project zip is not 413 here", () => {
    expect(
      oversizedJsonResponse(
        jsonReq("http://localhost/api/projects", 20 * 1024 * 1024, {
          contentType: "multipart/form-data; boundary=go",
        }),
      ),
    ).toBeNull();
  });
});

describe("proxy JSON body 413", () => {
  test("POST /api/notes with huge Content-Length is 413 + security headers", async () => {
    const res = proxy(
      new NextRequest("http://localhost/api/notes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(JSON_BODY_LIMIT + 1),
        },
      }),
    );
    expect(res.status).toBe(413);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain(JSON_BODY_TOO_LARGE);
  });

  test("GET /api/health is not 413", () => {
    const res = proxy(new NextRequest("http://localhost/api/health"));
    expect(res.status).not.toBe(413);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  test("voice POST at 256 KB+1 still proceeds", () => {
    const res = proxy(
      new NextRequest("http://localhost/api/notes/voice", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(JSON_BODY_LIMIT + 1),
        },
      }),
    );
    expect(res.status).not.toBe(413);
  });
});
