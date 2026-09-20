import { describe, expect, test } from "bun:test";

import {
  AGENT_LINK_CONNECTED,
  AGENT_LINK_RECONNECTING,
  AGENT_LINK_UNAVAILABLE,
  agentHealthUpFromJson,
  agentLinkLabel,
  agentLinkStatus,
  requestAgentStart,
} from "./agent-link";

describe("agent link status never fakes connected", () => {
  test("socket up is на связи even if health is still unknown", () => {
    expect(agentLinkStatus({ socketConnected: true, healthUp: null })).toBe(
      "connected",
    );
    expect(agentLinkStatus({ socketConnected: true, healthUp: false })).toBe(
      "connected",
    );
    expect(agentLinkLabel("connected")).toBe(AGENT_LINK_CONNECTED);
  });

  test("start failure is агент недоступен, not reconnecting", () => {
    expect(agentLinkStatus({ socketConnected: false, healthUp: false })).toBe(
      "unavailable",
    );
    expect(agentLinkLabel("unavailable")).toBe(AGENT_LINK_UNAVAILABLE);
    expect(agentLinkLabel("unavailable")).not.toBe(AGENT_LINK_RECONNECTING);
  });

  test("in-flight heal stays reconnecting until probe answers", () => {
    expect(agentLinkStatus({ socketConnected: false, healthUp: null })).toBe(
      "reconnecting",
    );
    expect(agentLinkStatus({ socketConnected: false, healthUp: true })).toBe(
      "reconnecting",
    );
    expect(agentLinkLabel("reconnecting")).toBe(AGENT_LINK_RECONNECTING);
  });

  test("health JSON up is boolean only", () => {
    expect(agentHealthUpFromJson({ up: true })).toBe(true);
    expect(agentHealthUpFromJson({ up: false, started: true })).toBe(false);
    expect(agentHealthUpFromJson({ error: "Агент недоступен" })).toBeNull();
    expect(agentHealthUpFromJson(null)).toBeNull();
  });

  test("requestAgentStart treats throw and missing up as down", async () => {
    expect(
      await requestAgentStart(async () => {
        throw new Error("offline");
      }),
    ).toEqual({ up: false });
    expect(
      await requestAgentStart(
        async () =>
          new Response(JSON.stringify({ error: "Требуется авторизация" }), {
            status: 401,
          }),
      ),
    ).toEqual({ up: false });
    expect(
      await requestAgentStart(
        async () =>
          new Response(JSON.stringify({ up: false, started: true }), {
            status: 503,
          }),
      ),
    ).toEqual({ up: false });
    expect(
      await requestAgentStart(
        async () =>
          new Response(JSON.stringify({ up: true, started: false }), {
            status: 200,
          }),
      ),
    ).toEqual({ up: true });
  });
});
