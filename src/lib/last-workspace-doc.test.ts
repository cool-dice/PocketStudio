import { describe, expect, test } from "bun:test";

import {
  lastDocStorageKey,
  readLastWorkspaceDoc,
  writeLastWorkspaceDoc,
} from "./last-workspace-doc";

function memoryKv(seed: Record<string, string> = {}) {
  const data = { ...seed };
  return {
    getItem(key: string) {
      return data[key] ?? null;
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
    removeItem(key: string) {
      delete data[key];
    },
    data,
  };
}

describe("last workspace document", () => {
  test("round-trips a cuid-like id", () => {
    const kv = memoryKv();
    writeLastWorkspaceDoc("ws1", "clastworkdoc01", kv);
    expect(kv.data[lastDocStorageKey("ws1")]).toBe("clastworkdoc01");
    expect(readLastWorkspaceDoc("ws1", kv)).toBe("clastworkdoc01");
  });

  test("rejects junk ids so they cannot hijack restore", () => {
    const kv = memoryKv({ [lastDocStorageKey("ws1")]: "../etc/passwd" });
    expect(readLastWorkspaceDoc("ws1", kv)).toBeNull();
  });
});
