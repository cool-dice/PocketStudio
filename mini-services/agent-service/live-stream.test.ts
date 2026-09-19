import { describe, expect, test } from "bun:test";

import {
  decideLiveDelta,
  newLiveStream,
  proseFromMixed,
  resetLiveBubble,
  streamedProseSoFar,
} from "./live-stream";

describe("decideLiveDelta", () => {
  test("does not paint `{` when the model starts a tool JSON object", () => {
    const live = newLiveStream();
    const first = decideLiveDelta(live, "{");
    expect(first.emitDelta).toBeNull();
    expect(live.mode).toBe("tool");
    const rest = decideLiveDelta(live, '"tool":"create_note","args":{}}');
    expect(rest.emitDelta).toBeNull();
    expect(live.mode).toBe("tool");
  });

  test("streams prose then holds the tool JSON so `{` never reaches the bubble", () => {
    const live = newLiveStream();
    const a = decideLiveDelta(live, "Сейчас запишу.\n");
    expect(a.emitStart).toBe(true);
    expect(a.emitDelta).toBe("Сейчас запишу.\n");
    expect(live.mode).toBe("text");
    const b = decideLiveDelta(live, '{"tool":"create_note","args":{}}');
    expect(b.emitDelta).toBeNull();
    expect(live.mode).toBe("tool");
    expect(proseFromMixed(live.acc, live.acc)).toBe("Сейчас запишу.");
  });

  test("resetLiveBubble lets the second stream after a tool start a new bubble", () => {
    const live = newLiveStream();
    decideLiveDelta(live, "Сначала файл.\n");
    live.messageId = "m-first";
    decideLiveDelta(live, '{"tool":"write_file","args":{"path":"a.ts"}}');
    expect(live.mode).toBe("tool");
    resetLiveBubble(live);
    expect(live.messageId).toBeNull();
    const second = decideLiveDelta(live, "Готово.");
    expect(second.emitStart).toBe(true);
    expect(second.emitDelta).toBe("Готово.");
    expect(live.mode).toBe("text");
  });

  test("streamedProseSoFar ignores held tool JSON on abort", () => {
    const live = newLiveStream();
    decideLiveDelta(live, "Черновик.\n");
    live.messageId = "m1";
    decideLiveDelta(live, '{"tool":"write_file"}');
    expect(streamedProseSoFar(live)).toBe("Черновик.");
  });

  test("prose and tool in the same first chunk still emit start for the prose", () => {
    const live = newLiveStream();
    const mixed = decideLiveDelta(
      live,
      'Сейчас файл.\n{"tool":"write_file","args":{"path":"a.ts"}}',
    );
    expect(mixed.emitStart).toBe(true);
    expect(mixed.emitDelta).toBe("Сейчас файл.\n");
    expect(live.mode).toBe("tool");
  });
});
