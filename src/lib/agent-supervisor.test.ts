import { describe, expect, test } from "bun:test";
import path from "node:path";

import { resolveAgentSupervisorPath } from "./agent-supervisor";

describe("resolveAgentSupervisorPath", () => {
  test("finds start.sh in cwd", () => {
    const cwd = "/repo";
    const hit = path.join(cwd, "mini-services/agent-service/start.sh");
    expect(resolveAgentSupervisorPath(cwd, (p) => p === hit)).toBe(hit);
  });

  test("walks up from a nested cwd like .next/standalone", () => {
    const root = "/repo";
    const hit = path.join(root, "mini-services/agent-service/start.sh");
    expect(
      resolveAgentSupervisorPath(path.join(root, ".next/standalone"), (p) => p === hit),
    ).toBe(hit);
  });

  test("returns null when the supervisor is missing", () => {
    expect(resolveAgentSupervisorPath("/tmp", () => false)).toBeNull();
  });
});
