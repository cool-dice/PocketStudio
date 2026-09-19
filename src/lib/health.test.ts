import { describe, expect, test } from "bun:test";

import {
  AGENT_PROBE_KEYS,
  AGENT_START_ERROR_KEYS,
  AGENT_START_KEYS,
  AGENT_SUPERVISOR_MISSING,
  AGENT_UNAVAILABLE,
  APP_HEALTH_KEYS,
  AUTH_REQUIRED,
  ERROR_ONLY_KEYS,
  HEALTH_DOWN_ERROR,
  agentCatchMessage,
  agentProbeJson,
  agentStartErrorJson,
  agentStartJson,
  appHealthJson,
  genericErrorJson,
  healthCatchMessage,
  jsonLooksLikeSecretLeak,
  probeUp,
} from "./health";

const LEAKY_ERROR = new Error(
  [
    "Can't reach DATABASE_URL=postgresql://pocketstudio:secret@127.0.0.1:5432/db",
    "AUTH_SECRET=super-secret-value",
    "    at probeDatabase (/workspace/src/lib/health.ts:12:5)",
  ].join("\n"),
);

describe("health JSON", () => {
  test("app health keys are only status up/down", () => {
    expect(Object.keys(appHealthJson(true))).toEqual([...APP_HEALTH_KEYS]);
    expect(Object.keys(appHealthJson(false))).toEqual([...APP_HEALTH_KEYS]);
    expect(appHealthJson(true)).toEqual({ status: "up" });
    expect(appHealthJson(false)).toEqual({ status: "down" });
  });

  test("agent probe keys are only up", () => {
    expect(Object.keys(agentProbeJson(true))).toEqual([...AGENT_PROBE_KEYS]);
    expect(Object.keys(agentProbeJson(false))).toEqual([...AGENT_PROBE_KEYS]);
    expect(agentProbeJson(true)).toEqual({ up: true });
    expect(agentProbeJson(false)).toEqual({ up: false });
  });

  test("agent start keys are up and started", () => {
    expect(Object.keys(agentStartJson(true, false))).toEqual([
      ...AGENT_START_KEYS,
    ]);
    expect(agentStartJson(true, true)).toEqual({ up: true, started: true });
  });

  test("errors are generic canned phrases, not exception text", () => {
    expect(healthCatchMessage(LEAKY_ERROR)).toBe(HEALTH_DOWN_ERROR);
    expect(agentCatchMessage(LEAKY_ERROR)).toBe(AGENT_UNAVAILABLE);
    expect(healthCatchMessage(LEAKY_ERROR)).not.toBe(LEAKY_ERROR.message);
    expect(Object.keys(genericErrorJson(AUTH_REQUIRED))).toEqual([
      ...ERROR_ONLY_KEYS,
    ]);
    expect(Object.keys(agentStartErrorJson(false))).toEqual([
      ...AGENT_START_ERROR_KEYS,
    ]);
    expect(agentStartErrorJson(false).error).toBe(AGENT_SUPERVISOR_MISSING);
  });

  test("payloads never echo DATABASE_URL, AUTH_SECRET, or stacks", () => {
    const bodies = [
      appHealthJson(true),
      appHealthJson(false),
      agentProbeJson(false),
      agentStartJson(false, true),
      agentStartErrorJson(false),
      genericErrorJson(healthCatchMessage(LEAKY_ERROR)),
      genericErrorJson(agentCatchMessage(LEAKY_ERROR)),
    ];
    for (const body of bodies) {
      expect(jsonLooksLikeSecretLeak(body)).toBe(false);
      const blob = JSON.stringify(body);
      expect(blob).not.toMatch(/DATABASE_URL/);
      expect(blob).not.toMatch(/AUTH_SECRET/);
      expect(blob).not.toMatch(/postgresql:\/\//);
    }
    expect(jsonLooksLikeSecretLeak(LEAKY_ERROR.message)).toBe(true);
  });

  test("probeUp swallows thrown secrets and reports down", async () => {
    expect(await probeUp(async () => undefined)).toBe(true);
    expect(
      await probeUp(async () => {
        throw LEAKY_ERROR;
      }),
    ).toBe(false);
  });
});
