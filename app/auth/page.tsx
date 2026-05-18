"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  AppFrame,
  AppShell,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardDescription,
  HeroPanel,
  SectionHeader,
} from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Mode = "login" | "register";

const inputClassName =
  "h-12 w-full rounded-[1.1rem] border border-[color:var(--border)] bg-white/78 px-4 text-sm text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--border-strong)] focus:ring-4 focus:ring-[color:var(--ring)]";

const trustPoints = [
  "登录后直接进入任务工作台，不需要再学 Prompt。",
  "分析、大纲、正文和检查都在服务端执行。",
  "上传任务书后，系统会先判断可生成度，再给你主动作。",
];

function toReadableAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return "认证请求失败，请稍后重试。";
  }

  const message = error.message.toLowerCase();

  if (
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("enotfound") ||
    message.includes("econnreset") ||
    message.includes("timeout")
  ) {
    return "当前无法连接认证服务，请检查网络、Supabase 地址配置，或稍后重试。";
  }

  return error.message;
}

export const dynamic = "force-dynamic";

export default function AuthPage() {
  const [supabase, setSupabase] =
    useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const healthResponse = await fetch("/api/system/supabase-health", {
          cache: "no-store",
        });
        const healthPayload = (await healthResponse
          .json()
          .catch(() => ({ ok: false, error: "Supabase 健康检查失败。" }))) as {
          ok?: boolean;
          error?: string;
        };

        if (!active) {
          return;
        }

        if (!healthResponse.ok || !healthPayload.ok) {
          setError(
            healthPayload.error || "Supabase 当前不可用，请检查配置后重试。",
          );
          setIsCheckingSession(false);
          return;
        }

        const client = createSupabaseBrowserClient();

        if (!active) {
          return;
        }

        setSupabase(client);

        const {
          data: { user },
        } = await client.auth.getUser();

        if (!active) {
          return;
        }

        if (user) {
          window.location.replace("/tasks");
          return;
        }

        setIsCheckingSession(false);
      } catch (initializationError) {
        if (!active) {
          return;
        }

        setError(
          toReadableAuthError(initializationError),
        );
        setIsCheckingSession(false);
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!supabase) {
      setError("Supabase 客户端尚未初始化，请稍后重试。");
      return;
    }

    setIsSubmitting(true);

    try {
      const trimmedEmail = email.trim();
      const trimmedDisplayName = displayName.trim();

      if (mode === "register") {
        const { data, error: signUpError } = await supabase.auth.signUp(
          {
            email: trimmedEmail,
            password,
            options: {
              data: trimmedDisplayName ? { display_name: trimmedDisplayName } : {},
            },
          },
        );

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        if (data.session) {
          setMessage("注册成功，正在进入任务页...");
          window.location.replace("/tasks");
          return;
        }

        setMessage("注册成功，请先完成邮箱验证，再回来登录。");
        setMode("login");
        return;
      }

      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (data.session) {
        setMessage("登录成功，正在进入任务页...");
        window.location.replace("/tasks");
      }
    } catch (submitError) {
      setError(toReadableAuthError(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingSession) {
    return (
      <AppShell>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="space-y-4 text-center">
            <div className="mx-auto h-11 w-11 animate-pulse rounded-full bg-[color:var(--primary-soft)]" />
            <p className="text-sm text-[color:var(--muted)]">正在检查登录状态...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!supabase) {
    return (
      <AppShell>
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="w-full max-w-xl rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-solid)]/90 p-7 text-center shadow-[var(--shadow-lg)]">
            <p className="text-xl font-semibold text-[color:var(--foreground)]">
              登录页暂时不可用
            </p>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
              {error || "Supabase 客户端初始化失败，请检查环境变量后重试。"}
            </p>
            <div className="mt-5 flex justify-center">
              <ButtonLink href="/demo" tone="secondary">
                先体验 Demo
              </ButtonLink>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppFrame className="grid gap-8 py-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch lg:py-12">
        <HeroPanel className="animate-rise flex min-h-[620px] flex-col justify-between">
          <div className="space-y-7">
            <div className="flex flex-wrap gap-2">
              <Badge tone="primary">学生入口</Badge>
              <Badge tone="accent">Moonshot</Badge>
              <Badge tone="success">Supabase Auth</Badge>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[color:var(--accent)]">
                Account Access
              </p>
              <h1 className="font-display max-w-3xl text-5xl leading-[0.95] text-[color:var(--foreground)] sm:text-6xl">
                登录后保存历史，
                <span className="block text-[color:var(--primary)]">
                  也可以先体验 Demo。
                </span>
              </h1>
              <p className="max-w-2xl text-sm leading-8 text-[color:var(--muted)] sm:text-base">
                输入实验任务要求后，系统会拆解步骤、生成代码、运行验证并整理报告。登录后可以保存任务历史；未登录也可以先看一遍完整 Demo。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/tasks/new" size="lg">
                开始创建任务
              </ButtonLink>
              <ButtonLink href="/demo" size="lg" tone="secondary">
                先体验 Demo
              </ButtonLink>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {trustPoints.map((point, index) => (
              <Card key={point} className="bg-white/72">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
                  0{index + 1}
                </p>
                <CardDescription className="mt-3 leading-7">
                  {point}
                </CardDescription>
              </Card>
            ))}
          </div>
        </HeroPanel>

        <Card className="animate-rise-delay relative overflow-hidden p-6 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[color:var(--primary)] via-[color:var(--accent)] to-[color:var(--success)]" />

          <div className="space-y-7">
            <SectionHeader
              eyebrow="Access"
              title={mode === "login" ? "登录账号" : "创建账号"}
              description={
                mode === "login"
                  ? "输入邮箱和密码，进入实验报告工作区。"
                  : "创建账号后即可开始新建实验报告任务。"
              }
            />

            <div className="rounded-full border border-[color:var(--border)] bg-white/55 p-1">
              <div className="grid grid-cols-2 gap-1">
                <Button
                  tone={mode === "login" ? "primary" : "ghost"}
                  className="w-full"
                  onClick={() => {
                    setError("");
                    setMessage("");
                    setMode("login");
                  }}
                >
                  登录
                </Button>
                <Button
                  tone={mode === "register" ? "primary" : "ghost"}
                  className="w-full"
                  onClick={() => {
                    setError("");
                    setMessage("");
                    setMode("register");
                  }}
                >
                  注册
                </Button>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "register" ? (
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[color:var(--foreground)]">
                    昵称
                  </span>
                  <input
                    className={inputClassName}
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="可选，用于资料展示"
                    autoComplete="name"
                  />
                </label>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-medium text-[color:var(--foreground)]">
                  邮箱
                </span>
                <input
                  className={inputClassName}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="请输入常用邮箱"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-[color:var(--foreground)]">
                  密码
                </span>
                <input
                  className={inputClassName}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 6 位"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={6}
                  required
                />
              </label>

              {error ? (
                <div className="rounded-[1.2rem] border border-[color:var(--danger)]/25 bg-[color:var(--danger-soft)] px-4 py-3 text-sm text-[color:var(--danger)]">
                  {error}
                </div>
              ) : null}

              {message ? (
                <div className="rounded-[1.2rem] border border-[color:var(--success)]/25 bg-[color:var(--success-soft)] px-4 py-3 text-sm text-[color:var(--success)]">
                  {message}
                </div>
              ) : null}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "处理中..."
                  : mode === "login"
                    ? "登录并进入任务页"
                    : "创建账号"}
              </Button>
            </form>

            <p className="text-xs leading-6 text-[color:var(--muted)]">
              {mode === "login"
                ? "还没有账号？切换到注册即可开始使用。"
                : "如果 Supabase 开启了邮箱确认，注册后请先完成验证。"}
            </p>
          </div>
        </Card>
      </AppFrame>
    </AppShell>
  );
}
