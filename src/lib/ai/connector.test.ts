import { afterEach, describe, expect, test } from "bun:test";

import {
  chatCompletion,
  createEmbeddings,
  generateImage,
  mapTtsVoice,
  synthesizeSpeech,
  transcribeAudio,
} from "./connector";
import type { ResolvedRoute } from "./connector";
import { GatewayError } from "./errors";
import { pickCandidate, type LoadedCandidate } from "./resolve";
import { UNCONFIGURED_TOOL_MESSAGE } from "./tools";

const openaiRoute: ResolvedRoute = {
  toolId: "agent",
  provider: {
    id: "p1",
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

afterEach(() => {
  (globalThis as { fetch?: typeof fetch }).fetch = originalFetch;
});

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("OpenAI chat", () => {
  test("parses choices[0].message.content and applies markup", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("gpt-4o-mini");
      expect(body.messages[0].role).toBe("system");
      expect(body.response_format).toEqual({ type: "json_object" });
      const auth = (init?.headers as Record<string, string>).authorization;
      expect(auth).toBe("Bearer sk-test");
      return jsonResponse({
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
    }) as typeof fetch;

    const result = await chatCompletion(
      openaiRoute,
      [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
      { jsonMode: true },
    );
    expect(result.text).toBe('{"ok":true}');
    expect(result.usage.tokensOut).toBe(5);
    expect(result.usage.billableTokensOut).toBe(6); // 5 * 1.2
  });

  test("maps 401 to a Russian error and never echoes the key", async () => {
    globalThis.fetch = (async () =>
      jsonResponse({ error: { message: "invalid sk-test-secret" } }, 401)) as typeof fetch;
    try {
      await chatCompletion(openaiRoute, [{ role: "user", content: "hi" }]);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(GatewayError);
      expect((err as GatewayError).status).toBe(401);
      expect((err as GatewayError).message).toContain("ключ");
      expect((err as GatewayError).message).not.toContain("sk-test");
    }
  });
});

describe("Anthropic messages", () => {
  test("sends system separately and reads content blocks", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.anthropic.com/v1/messages");
      const headers = init?.headers as Record<string, string>;
      expect(headers["x-api-key"]).toBe("sk-ant-test");
      expect(headers["anthropic-version"]).toBe("2023-06-01");
      const body = JSON.parse(String(init?.body));
      expect(body.system).toBe("sys");
      expect(body.messages[0]).toEqual({ role: "user", content: "hi" });
      return jsonResponse({
        content: [{ type: "text", text: "привет" }],
        usage: { input_tokens: 3, output_tokens: 2 },
      });
    }) as typeof fetch;

    const result = await chatCompletion(anthropicRoute, [
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
    ]);
    expect(result.text).toBe("привет");
    expect(result.usage.tokensIn).toBe(3);
  });

  test("image generation fails with a clear Russian error", async () => {
    try {
      await generateImage(anthropicRoute, { prompt: "cat" });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(GatewayError);
      expect((err as GatewayError).message).toMatch(/Anthropic/);
      expect((err as GatewayError).message).toMatch(/изображен/);
    }
  });

  test("TTS fails with a clear Russian error", async () => {
    try {
      await synthesizeSpeech(anthropicRoute, { text: "hi" });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(GatewayError);
      expect((err as GatewayError).message).toMatch(/озвуч/);
    }
  });

  test("embeddings fail with a clear Russian error", async () => {
    try {
      await createEmbeddings(anthropicRoute, ["карие глаза"]);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(GatewayError);
      expect((err as GatewayError).message).toMatch(/эмбеддинг/i);
    }
  });

  test("ASR fails with a clear Russian error", async () => {
    try {
      await transcribeAudio(anthropicRoute, { buffer: Buffer.from("wav") });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(GatewayError);
      expect((err as GatewayError).message).toMatch(/распознавать речь|Anthropic/);
    }
  });
});

describe("OpenAI ASR", () => {
  test("returns trimmed transcript text", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://api.openai.com/v1/audio/transcriptions");
      return jsonResponse({ text: "  маяк в тумане  " });
    }) as typeof fetch;
    const text = await transcribeAudio(openaiRoute, {
      buffer: Buffer.from("wav"),
      mime: "audio/wav",
    });
    expect(text).toBe("маяк в тумане");
  });

  test("empty provider payload is an empty string, not success prose", async () => {
    globalThis.fetch = (async () => jsonResponse({})) as typeof fetch;
    const text = await transcribeAudio(openaiRoute, { buffer: Buffer.from("wav") });
    expect(text).toBe("");
  });

  test("timeout becomes a Russian 504", async () => {
    globalThis.fetch = (async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }) as typeof fetch;
    try {
      await transcribeAudio(openaiRoute, { buffer: Buffer.from("wav") });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(GatewayError);
      expect((err as GatewayError).status).toBe(504);
      expect((err as GatewayError).message).toMatch(/вовремя/);
    }
  });
});

describe("OpenAI embeddings", () => {
  test("POSTs /embeddings and returns vectors in order", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.openai.com/v1/embeddings");
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("gpt-4o-mini");
      expect(body.input).toEqual(["hello", "world"]);
      return jsonResponse({
        data: [
          { index: 1, embedding: [0, 1] },
          { index: 0, embedding: [1, 0] },
        ],
      });
    }) as typeof fetch;
    const { vectors, dim } = await createEmbeddings(openaiRoute, ["hello", "world"]);
    expect(dim).toBe(2);
    expect(vectors).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });
});

describe("OpenAI image", () => {
  test("decodes b64_json", async () => {
    const png = Buffer.from("hello-image").toString("base64");
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://api.openai.com/v1/images/generations");
      return jsonResponse({ data: [{ b64_json: png }] });
    }) as typeof fetch;
    const { buffer } = await generateImage(openaiRoute, { prompt: "cat" });
    expect(buffer.toString()).toBe("hello-image");
  });
});

describe("OpenAI TTS", () => {
  test("maps z-ai voice ids to OpenAI names", () => {
    expect(mapTtsVoice("tongtong")).toBe("alloy");
    expect(mapTtsVoice("Tongtong")).toBe("alloy");
    expect(mapTtsVoice("nova")).toBe("nova");
    expect(mapTtsVoice(undefined)).toBe("alloy");
  });

  test("POSTs mapped OpenAI voice and rejects an empty file", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.openai.com/v1/audio/speech");
      const body = JSON.parse(String(init?.body));
      expect(body.voice).toBe("alloy");
      expect(body.input).toBe("маяк");
      return new Response(Buffer.from("RIFF"), { status: 200 });
    }) as typeof fetch;
    const buf = await synthesizeSpeech(openaiRoute, {
      text: "маяк",
      voice: "tongtong",
    });
    expect(buf.toString()).toBe("RIFF");

    globalThis.fetch = (async () =>
      new Response(new Uint8Array(), { status: 200 })) as typeof fetch;
    try {
      await synthesizeSpeech(openaiRoute, { text: "маяк", voice: "nova" });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(GatewayError);
      expect((err as GatewayError).message).toMatch(/пустой файл/);
    }
  });
});

function candidate(partial: Partial<LoadedCandidate> & { providerUserId: string | null }): LoadedCandidate {
  return {
    providerId: "p",
    providerKind: "openai_compatible",
    providerName: "OpenAI",
    providerBaseUrl: "https://api.openai.com/v1",
    providerApiKey: "sk",
    providerExtraHeaders: null,
    providerEnabled: true,
    providerVisible: true,
    markupPercent: null,
    markupMultiplier: null,
    modelRowId: "m",
    modelId: "gpt",
    displayName: "GPT",
    capChat: true,
    capImage: false,
    capTts: false,
    capAsr: false,
    capEmbeddings: false,
    modelEnabled: true,
    ...partial,
  };
}

describe("pickCandidate", () => {
  test("prefers a valid user override", () => {
    const picked = pickCandidate({
      toolId: "agent",
      capability: "chat",
      userId: "u1",
      override: candidate({ providerUserId: "u1" }),
      platformDefault: candidate({ providerUserId: null, modelId: "platform" }),
    });
    expect(picked.modelId).toBe("gpt");
  });

  test("falls back to platform default", () => {
    const picked = pickCandidate({
      toolId: "agent",
      capability: "chat",
      userId: "u1",
      override: null,
      platformDefault: candidate({ providerUserId: null, modelId: "platform" }),
    });
    expect(picked.modelId).toBe("platform");
  });

  test("throws the Russian unconfigured message", () => {
    expect(() =>
      pickCandidate({
        toolId: "agent",
        capability: "chat",
        userId: "u1",
        override: null,
        platformDefault: null,
      }),
    ).toThrow(UNCONFIGURED_TOOL_MESSAGE);
  });

  test("ASR without a capable model uses the same unconfigured message", () => {
    expect(() =>
      pickCandidate({
        toolId: "asr",
        capability: "asr",
        userId: "u1",
        override: null,
        platformDefault: candidate({ providerUserId: null, capAsr: false }),
      }),
    ).toThrow(UNCONFIGURED_TOOL_MESSAGE);
  });
});
