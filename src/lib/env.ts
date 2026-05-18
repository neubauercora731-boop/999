export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL. " +
        "Fill it in .env.local at the project root and restart the dev server.",
    );
  }

  if (!anonKey) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Fill it in .env.local at the project root and restart the dev server.",
    );
  }

  return {
    url,
    anonKey,
  };
}

export function getSupabaseServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key) {
    throw new Error(
      "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY. " +
        "Fill it in .env.local at the project root and restart the dev server.",
    );
  }

  return key;
}

export function getMoonshotEnv() {
  const apiKey = process.env.MOONSHOT_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "Missing required environment variable: MOONSHOT_API_KEY. " +
        "Fill it in .env.local at the project root and restart the dev server.",
    );
  }

  return {
    apiKey,
    baseUrl:
      process.env.MOONSHOT_BASE_URL?.trim() || "https://api.moonshot.ai/v1",
    model: process.env.MOONSHOT_MODEL?.trim() || "kimi-k2.5",
  };
}
