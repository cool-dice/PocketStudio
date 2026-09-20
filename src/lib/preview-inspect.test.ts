import { describe, expect, test } from "bun:test";

import { injectPreviewInspect } from "./preview-inspect";

describe("injectPreviewInspect", () => {
  test("injects the click script before </body>", () => {
    const html = injectPreviewInspect("<html><body><h1>Hi</h1></body></html>");
    expect(html).toContain("data-pocketstudio-inspect");
    expect(html).toContain("pocketstudio-inspect");
    expect(html.indexOf("data-pocketstudio-inspect")).toBeLessThan(html.indexOf("</body>"));
  });
});
