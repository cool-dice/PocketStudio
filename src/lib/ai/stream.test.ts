import { afterEach, describe, expect, test } from "bun:test";

import { GatewayError } from "./errors";
import {
  chatCompletionStream,
  extractStreamDelta,
  resetStreamFallbackLog,
} from "./stream";
import type { ResolvedRoute } from "./connector";

const openaiRoute: ResolvedRoute = {
  toolId: "agent",
  provider: {
    id: "p-openai",
    kind: "openai_compatible",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-test",
    extraHeaders: null,
    isPlatform: true,
    markupPercent: 20,
    markupMultiplier: null,
  },
  model: {
    id: "m1",
    modelId: "gpt-4o-mini",
    displayName: "GPT-4o mini",
    capChat: true,
    capImage: true,
    capTts: true,
    capAsr: true,
    capEmbeddings: false,
  },
};

const anthropicRoute: ResolvedRoute = {
  ...openaiRoute,
  provider: {
    ...openaiRoute.provider,
    id: "p-anthropic",
    kind: "anthropic_compatible",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    apiKey: "sk-ant-test",
  },
  model: {
    ...openaiRoute.model,
    modelId: "claude-sonnet-4-5-20250929",
    displayName: "Sonnet",
    capImage: false,
    capTts: false,
    capAsr: false,
  },
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetStreamFallbackLog();
});

function sseResponse(frames: string[], headers?: Record<string, string>): Response {
  const body = frames.join("");
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream", ...headers },
  });
}

function openaiFrame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

function anthropicFrame(text: string): string {
  return `event: content_block_delta\ndata: ${JSON.stringify({
    type: "content_block_delta",
    delta: { type: "text_delta", text },
  })}\n\n`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("extractStreamDelta", () => {
  test("reads OpenAI choices[0].delta.content", () => {
    expect(
      extractStreamDelta({ choices: [{ delta: { content: "Hel" } }] }),
    ).toBe("Hel");
  });

  test("reads Anthropic content_block_delta text", () => {
    expect(
      extractStreamDelta({
        type: "content_block_delta",
        delta: { type: "text_delta", text: "при" },
      }),
    ).toBe("при");
  });
});

describe("OpenAI SSE chat", () => {
  test("sends stream:true and emits tokens as they arrive", async () => {
    const deltas: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.openai.com/v1/chat/completions");
      const body = JSON.parse(String(init?.body));
      expect(body.stream).toBe(true);
      expect(body.model).toBe("gpt-4o-mini");
      return sseResponse([
        openaiFrame("Hel"),
        openaiFrame("lo"),
        "data: [DONE]\n\n",
      ]);
    }) as typeof fetch;

    const result = await chatCompletionStream(
      openaiRoute,
      [{ role: "user", content: "hi" }],
      { onDelta: (d) => deltas.push(d) },
    );
    expect(deltas).toEqual(["Hel", "lo"]);
    expect(result.text).toBe("Hello");
    expect(result.usage.billableTokensOut).toBeNull();
  });

  test("reassembles SSE frames split across chunks", async () => {
    const encoder = new TextEncoder();
    const payload = openaiFrame("Hi") + "data: [DONE]\n\n";
    globalThis.fetch = (async () => {
      const bytes = encoder.encode(payload);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes.slice(0, 10));
          controller.enqueue(bytes.slice(10));
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    }) as typeof fetch;
    const result = await chatCompletionStream(openaiRoute, [
      { role: "user", content: "hi" },
    ]);
    expect(result.text).toBe("Hi");
  });

  test("records usage from a later SSE frame", async () => {
    globalThis.fetch = (async () =>
      sseResponse([
        openaiFrame("ok"),
        `data: ${JSON.stringify({
          choices: [{ delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 4, completion_tokens: 5 },
        })}\n\n`,
        "data: [DONE]\n\n",
      ])) as typeof fetch;
    const result = await chatCompletionStream(openaiRoute, [
      { role: "user", content: "hi" },
    ]);
    expect(result.usage.tokensIn).toBe(4);
    expect(result.usage.tokensOut).toBe(5);
    expect(result.usage.billableTokensOut).toBe(6);
  });
});

describe("Anthropic SSE chat", () => {
  test("sends stream:true on /v1/messages and concatenates text_delta", async () => {
    const deltas: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.anthropic.com/v1/messages");
      const body = JSON.parse(String(init?.body));
      expect(body.stream).toBe(true);
      expect(body.system).toBe("sys");
      const headers = init?.headers as Record<string, string>;
      expect(headers["x-api-key"]).toBe("sk-ant-test");
      return sseResponse([
        `event: message_start\ndata: ${JSON.stringify({
          type: "message_start",
          message: { usage: { input_tokens: 3, output_tokens: 0 } },
        })}\n\n`,
        anthropicFrame("при"),
        anthropicFrame("вет"),
        `event: message_delta\ndata: ${JSON.stringify({
          type: "message_delta",
          usage: { output_tokens: 2 },
        })}\n\n`,
        "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n",
      ]);
    }) as typeof fetch;

    const result = await chatCompletionStream(
      anthropicRoute,
      [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
      { onDelta: (d) => deltas.push(d) },
    );
    expect(deltas).toEqual(["при", "вет"]);
    expect(result.text).toBe("привет");
    expect(result.usage.tokensIn).toBe(3);
    expect(result.usage.tokensOut).toBe(2);
  });
});

describe("abort mid-stream", () => {
  test("cancels the HTTP body and returns 499", async () => {
    const ac = new AbortController();
    let cancelled = false;
    const encoder = new TextEncoder();
    globalThis.fetch = ((_url, init) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(openaiFrame("Hel")));
          const signal = init?.signal;
          if (signal?.aborted) {
            cancelled = true;
            controller.close();
            return;
          }
          signal?.addEventListener("abort", () => {
            cancelled = true;
            controller.error(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        },
        cancel() {
          cancelled = true;
        },
      });
      return Promise.resolve(
        new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );
    }) as typeof fetch;

    const deltas: string[] = [];
    const pending = chatCompletionStream(
      openaiRoute,
      [{ role: "user", content: "hi" }],
      {
        signal: ac.signal,
        onDelta: (d) => {
          deltas.push(d);
          ac.abort();
        },
      },
    );
    try {
      await pending;
      throw new Error("expected abort");
    } catch (err) {
      expect(err).toBeInstanceOf(GatewayError);
      expect((err as GatewayError).status).toBe(499);
      expect((err as GatewayError).message).toBe("Генерация остановлена");
    }
    expect(deltas).toEqual(["Hel"]);
    expect(cancelled).toBe(true);
  });
});

describe("stream fallback", () => {
  test("one-shot complete when stream errors, logged once per provider", async () => {
    const warns: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warns.push(args.map(String).join(" "));
    };
    let calls = 0;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      if (body.stream === true) {
        return jsonResponse({ error: { message: "stream not supported" } }, 400);
      }
      return jsonResponse({
        choices: [{ message: { content: "fallback-ok" } }],
        usage: { prompt_tokens: 1, completion_tokens: 2 },
      });
    }) as typeof fetch;

    try {
      const first = await chatCompletionStream(openaiRoute, [
        { role: "user", content: "hi" },
      ]);
      expect(first.text).toBe("fallback-ok");
      const second = await chatCompletionStream(openaiRoute, [
        { role: "user", content: "hi" },
      ]);
      expect(second.text).toBe("fallback-ok");
    } finally {
      console.warn = originalWarn;
    }
    expect(calls).toBe(4); // stream fail + one-shot, twice
    expect(warns.filter((w) => w.includes("falling back to one-shot")).length).toBe(1);
  });

  test("jsonMode never sends stream:true", async () => {
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.stream).toBeUndefined();
      expect(body.response_format).toEqual({ type: "json_object" });
      return jsonResponse({
        choices: [{ message: { content: '{"ok":true}' } }],
      });
    }) as typeof fetch;
    const result = await chatCompletionStream(
      openaiRoute,
      [{ role: "user", content: "hi" }],
      { jsonMode: true },
    );
    expect(result.text).toBe('{"ok":true}');
  });
});
