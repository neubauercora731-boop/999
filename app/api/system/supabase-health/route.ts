import { lookup } from "node:dns/promises";

import { NextResponse } from "next/server";

import { getSupabasePublicEnv } from "@/lib/env";

export const runtime = "nodejs";

function toReadableHealthError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Supabase 连接检查失败。";
  }

  const message = error.message.toLowerCase();

  if (
    message.includes("enotfound") ||
    message.includes("dns") ||
    message.includes("getaddrinfo")
  ) {
    return "Supabase 项目域名无法解析。请检查 Project URL 是否填写正确，或确认项目未被暂停/删除。";
  }

  if (
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("timeout")
  ) {
    return "当前无法连接到 Supabase 认证服务，请检查网络或稍后重试。";
  }

  return error.message;
}

export async function GET() {
  try {
    const env = getSupabasePublicEnv();
    const url = new URL(env.url);

    await lookup(url.hostname);

    const response = await fetch(`${url.origin}/auth/v1/health`, {
      headers: {
        apikey: env.anonKey,
        Authorization: `Bearer ${env.anonKey}`,
      },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Supabase 认证服务返回异常状态：${response.status}。请检查项目状态与 API 地址。`,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: toReadableHealthError(error),
      },
      { status: 503 },
    );
  }
}
