import { z } from "zod";

const DEFAULT_MESSAGE = "Hello from starter-app!";

const environmentSchema = z.object({
  APP_MESSAGE: z
    .string()
    .min(1, "must be non-empty")
    .max(200, "must be at most 200 characters")
    .optional(),
});

export interface AppConfig {
  message: string;
}

export type ConfigResult =
  { ok: true; value: AppConfig } | { error: string; ok: false };

export function loadConfig(
  environment: Readonly<Record<string, string | undefined>>,
): ConfigResult {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) {
    const diagnostic = parsed.error.issues[0]?.message ?? "is invalid";
    return {
      error: `Invalid APP_MESSAGE: ${diagnostic}`,
      ok: false,
    };
  }
  return {
    ok: true,
    value: { message: parsed.data.APP_MESSAGE ?? DEFAULT_MESSAGE },
  };
}
