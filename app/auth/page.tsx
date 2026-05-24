"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  AppFrame,
  AppShell,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardDescription,
  CardTitle,
  HeroPanel,
  SectionHeader,
} from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Mode = "login" | "register";

const inputClassName =
  "h-12 w-full rounded-lg border border-[color:var(--border)] bg-white/82 px-4 text-sm text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--border-strong)] focus:ring-4 focus:ring-[color:var(--ring)]";

const trustPoints = [
  "登录后进入任务中心，任务书、运行证据和导出记录会保存到你的账号下。",
  "代码生成、真实运行、Trace 和 DOCX 导出都在受控工作流里完成。",
  "系统不会把服务端密钥放到前端，也不会自动提交学校系统。",
];

function toReadableAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return "认证请求失败，请稍后重试。";
  }

  const message = error.message.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "邮箱或密码不正确。如果刚修改过密码，请使用最新密码重新登录。";
  }

  if (message.includes("email not confirmed")) {
    return "邮箱还没有完成验证，请先打开注册邮件中的确认链接。";
  }

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
  const router = useRouter();
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

        if (!active) return;

        if (!healthResponse.ok || !healthPayload.ok) {
          setError(
            healthPayload.error || "Supabase 当前不可用，请检查配置后重试。",
          );
          setIsCheckingSession(false);
          return;
        }

        const client = createSupabaseBrowserClient();
        if (!active) return;

        setSupabase(client);

        const {
          data: { user },
        } = await client.auth.getUser();

        if (!active) return;

        if (user) {
          router.replace("/tasks");
          router.refresh();
          return;
        }

        setIsCheckingSession(false);
      } catch (initializationError) {
        if (!active) return;

        setError(toReadableAuthError(initializationError));
        setIsCheckingSession(false);
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [router]);

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
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: trimmedDisplayName ? { display_name: trimmedDisplayName } : {},
          },
        });

        if (signUpError) {
          setError(toReadableAuthError(signUpError));
          return;
        }

        if (data.session) {
          setMessage("注册成功，正在进入任务中心...");
          router.replace("/tasks");
          router.refresh();
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
        setError(toReadableAuthError(signInError));
        return;
      }

      if (data.session) {
        setMessage("登录成功，正在进入任务中心...");
        router.replace("/tasks");
        router.refresh();
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
          <Card className="w-full max-w-xl p-7 text-center">
            <CardTitle>登录页暂时不可用</CardTitle>
            <CardDescription className="mt-3">
              {error || "Supabase 客户端初始化失败，请检查环境变量后重试。"}
            </CardDescription>
            <div className="mt-5 flex justify-center">
              <ButtonLink href="/" tone="secondary">
                返回首页
              </ButtonLink>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppFrame className="grid gap-8 py-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-stretch lg:py-12">
        <HeroPanel className="animate-rise flex min-h-[560px] flex-col justify-between">
          <div className="space-y-7">
            <div className="flex flex-wrap gap-2">
              <Badge tone="primary">学生工作台</Badge>
              <Badge tone="success">Supabase Auth</Badge>
              <Badge tone="accent">任务历史保存</Badge>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
                Account Access
              </p>
              <h1 className="font-display max-w-3xl text-4xl font-semibold leading-tight text-[color:var(--foreground)] sm:text-5xl">
                登录后继续实验任务，
                <span className="block text-[color:var(--primary)]">
                  Trace、截图和 DOCX 都会保存。
                </span>
              </h1>
              <p className="max-w-2xl text-sm leading-8 text-[color:var(--muted)] sm:text-base">
                登录用于保存任务历史和导出记录。系统会把上传材料、真实运行证据、
                截图 metadata 和 DOCX 导出状态关联到当前账号。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/tasks/new" size="lg">
                创建任务
              </ButtonLink>
              <ButtonLink href="/" size="lg" tone="secondary">
                返回首页
              </ButtonLink>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {trustPoints.map((point, index) => (
              <Card key={point} className="bg-white/76">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                  0{index + 1}
                </p>
                <CardDescription className="mt-3 leading-7">
                  {point}
                </CardDescription>
              </Card>
            ))}
          </div>
        </HeroPanel>

        <Card className="animate-rise-delay p-6 sm:p-8">
          <div className="space-y-7">
            <SectionHeader
              eyebrow="Access"
              title={mode === "login" ? "登录账号" : "创建账号"}
              description={
                mode === "login"
                  ? "使用邮箱和密码进入任务中心。"
                  : "创建账号后可以保存实验任务和导出记录。"
              }
            />

            <form className="space-y-5" onSubmit={handleSubmit}>
              {mode === "register" ? (
                <label className="block space-y-2">
                  <span className="text-sm font-semibold">昵称（可选）</span>
                  <input
                    className={inputClassName}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="例如：张同学"
                    autoComplete="name"
                  />
                </label>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-semibold">邮箱</span>
                <input
                  className={inputClassName}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold">密码</span>
                <input
                  className={inputClassName}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入密码"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                />
              </label>

              {error ? (
                <div className="rounded-lg border border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--danger)]">
                  {error}
                </div>
              ) : null}

              {message ? (
                <div className="rounded-lg border border-[color:var(--success)]/30 bg-[color:var(--success-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--success)]">
                  {message}
                </div>
              ) : null}

              <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? mode === "login"
                    ? "登录中..."
                    : "注册中..."
                  : mode === "login"
                    ? "登录并进入任务中心"
                    : "创建账号"}
              </Button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] pt-5">
              <p className="text-sm text-[color:var(--muted)]">
                {mode === "login" ? "还没有账号？" : "已经有账号？"}
              </p>
              <Button
                tone="ghost"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError("");
                  setMessage("");
                }}
              >
                {mode === "login" ? "创建账号" : "返回登录"}
              </Button>
            </div>
          </div>
        </Card>
      </AppFrame>
    </AppShell>
  );
}
