import {
  AppFrame,
  AppSection,
  AppShell,
  Badge,
  ButtonLink,
  HeroPanel,
} from "@/components/ui";

import { DemoWorkflow } from "./demo-workflow";

export default function DemoPage() {
  return (
    <AppShell>
      <AppFrame className="py-8 sm:py-10">
        <AppSection className="space-y-6 pt-0">
          <HeroPanel className="animate-rise">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.72fr] lg:items-end">
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="primary">Demo</Badge>
                  <Badge tone="success">无需登录</Badge>
                  <Badge tone="accent">完整闭环</Badge>
                </div>
                <div className="space-y-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[color:var(--accent)]">
                    Try The Workflow
                  </p>
                  <h1 className="font-display max-w-4xl text-5xl leading-[0.96] text-[color:var(--foreground)] sm:text-6xl">
                    先看一次 AI 如何完成实验报告流程。
                  </h1>
                  <p className="max-w-2xl text-sm leading-8 text-[color:var(--muted)] sm:text-base">
                    Demo 使用冒泡排序实验作为固定样例，展示任务理解、代码生成、运行验证和报告整理。正式任务登录后可保存历史。
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <ButtonLink href="/tasks/new" size="lg">
                  开始创建任务
                </ButtonLink>
                <ButtonLink href="/auth" size="lg" tone="secondary">
                  登录保存历史
                </ButtonLink>
              </div>
            </div>
          </HeroPanel>
        </AppSection>

        <AppSection className="pt-0">
          <DemoWorkflow />
        </AppSection>
      </AppFrame>
    </AppShell>
  );
}
