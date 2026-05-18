export class MissingEnvironmentVariableError extends Error {
  constructor(public readonly variableName: string) {
    super(
      `Missing required environment variable: ${variableName}. ` +
        "Fill it in .env.local at the project root and restart the dev server.",
    );
    this.name = "MissingEnvironmentVariableError";
  }
}

export function isMissingEnvironmentVariableError(
  error: unknown,
): error is MissingEnvironmentVariableError {
  return error instanceof MissingEnvironmentVariableError;
}

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url) {
    throw new MissingEnvironmentVariableError("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!anonKey) {
    throw new MissingEnvironmentVariableError("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return {
    url,
    anonKey,
  };
}

export function getSupabaseServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key) {
    throw new MissingEnvironmentVariableError("SUPABASE_SERVICE_ROLE_KEY");
  }

  return key;
}

export function getMoonshotEnv() {
  const apiKey = process.env.MOONSHOT_API_KEY?.trim();

  if (!apiKey) {
    throw new MissingEnvironmentVariableError("MOONSHOT_API_KEY");
  }

  return {
    apiKey,
    baseUrl:
      process.env.MOONSHOT_BASE_URL?.trim() || "https://api.moonshot.ai/v1",
    model: process.env.MOONSHOT_MODEL?.trim() || "kimi-k2.5",
  };
}
