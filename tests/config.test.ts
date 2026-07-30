import { describe, expect, test } from "vitest";

import { loadConfig } from "../src/config.ts";

describe("loadConfig", () => {
  test(
    "uses a safe default when APP_MESSAGE is absent",
    { tags: ["small"] },
    () => {
      expect(loadConfig({})).toEqual({
        ok: true,
        value: { message: "Hello from starter-app!" },
      });
    },
  );

  test.each([
    ["", "non-empty"],
    ["x".repeat(201), "at most 200"],
  ])(
    "rejects invalid APP_MESSAGE without echoing it",
    { tags: ["small"] },
    (message, expectedDiagnostic) => {
      const result = loadConfig({ APP_MESSAGE: message });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain(expectedDiagnostic);
        if (message !== "") {
          expect(result.error).not.toContain(message);
        }
      }
    },
  );
});
