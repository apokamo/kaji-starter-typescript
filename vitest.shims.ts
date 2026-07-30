import "vitest";

declare module "vitest" {
  interface TestTags {
    large: "large";
    medium: "medium";
    small: "small";
  }
}
