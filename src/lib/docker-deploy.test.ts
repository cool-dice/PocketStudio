import { describe, expect, test } from "bun:test";

import { whichDocker } from "./docker-deploy";

describe("whichDocker", () => {
  test("reports a real presence and never throws", async () => {
    const presence = await whichDocker();
    expect(["ok", "no-cli", "no-daemon"]).toContain(presence);
  });
});
