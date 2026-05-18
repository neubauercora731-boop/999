import {
  AppFrame,
  AppSection,
  AppShell,
  Badge,
  ButtonLink,
  Card,
  CardDescription,
  CardTitle,
  HeroPanel,
  SectionHeader,
} from "@/components/ui";

const coreFlow = [
  "输入实验任务要求",
  "AI 拆解实验步骤",
  "自动生成实验代码",
  "运行并返回结果",
  "整理实验报告",
  "保存到我的任务",
];

const capabilities = [
  "AI 拆解实验任务",
  "生成实验代码",
  "运行验证结果",
  "整理实验报告",
  "保存历史任务",
];

const scenarios = [
  "Python 基础实验",
  "数据结构算法实验",
  "Web 前端实验",
  "数据库实验报告",
  "课程实践记录整理",
];

const productSignals = [
  {
    title: "不是普通聊天框",
    description: "任务会被拆成理解、生成、运行、整理报告等明确步骤，用户能看到系统正在做什么。",
  },
  {
    title: "先体验再登录",
    description: "Demo 不依赖登录和数据库，适合演示完整流程；正式任务登录后再保存历史。",
  },
  {
    title: "学习辅助定位",
    description: "系统负责组织材料、生成草稿和验证代码，最终内容仍由用户确认、修改和导出。",
  },
];

export default function Home() {
  return (
    <AppShell>
      <AppFrame className="py-8 sm:py-10">
        <AppSection className="space-y-6 pt-0">
          <HeroPanel className="animate-rise">
            <div className="grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
              <div className="space-y-7">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="primary">AI 工作流</Badge>
                  <Badge tone="accent">实验报告整理</Badge>
                  <Badge tone="success">P0 可演示闭环</Badge>
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[color:var(--accent)]">
                    Lab Report Automation
                  </p>
                  <h1 className="font-display max-w-4xl text-5xl leading-[0.96] text-[color:var(--foreground)] sm:text-6xl xl:text-7xl">
                    AI 实验报告自动化助手
                  </h1>
                  <p className="max-w-2xl text-base leading-8 text-[color:var(--muted)] sm:text-lg">
                    输入老师布置的实验要求，系统会自动帮你拆解任务、生成代码、运行验证，并整理成实验报告内容。
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <ButtonLink href="/tasks/new" size="lg">
                    开始创建任务
                  </ButtonLink>
                  <ButtonLink href="/demo" size="lg" tone="secondary">
                    先体验 Demo
                  </ButtonLink>
                </div>
              </div>

              <div className="space-y-4">
                <Card className="bg-white/78">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                        Core Flow
                      </p>
                      <CardTitle className="mt-2">从任务要求到报告草稿</CardTitle>
                    </div>
                    <Badge tone="success">Ready</Badge>
                  </div>
                  <div className="mt-5 grid gap-3">
                    {coreFlow.map((item, index) => (
                      <div
                        key={item}
                        className="flex items-center gap-3 rounded-[1rem] border border-[color:var(--border)] bg-white/70 px-4 py-3 text-sm text-[color:var(--foreground-soft)]"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--primary-soft)] text-xs font-semibold text-[color:var(--primary)]">
                          {index + 1}
                        </span>
                        {item}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </HeroPanel>
        </AppSection>

        <AppSection>
          <SectionHeader
            eyebrow="Product"
            title="它能做什么"
            description="当前版本聚焦一个可验证闭环：把实验要求转成步骤、代码、运行证据和报告草稿。"
          />
          <div className="mt-6 grid gap-4 md:grid-cols-5">
            {capabilities.map((item, index) => (
              <Card key={item} className="space-y-3 bg-white/72">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
                  0{index + 1}
                </p>
                <CardTitle className="text-base">{item}</CardTitle>
              </Card>
            ))}
          </div>
        </AppSection>

        <AppSection>
          <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="space-y-4">
              <SectionHeader
                eyebrow="Use Cases"
                title="适合哪些场景"
                description="优先服务课程实验和实践记录整理，不承诺替代人工判断。"
              />
              <div className="flex flex-wrap gap-2">
                {scenarios.map((scenario) => (
                  <Badge key={scenario} tone="neutral">
                    {scenario}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {productSignals.map((item) => (
                <Card key={item.title} className="space-y-3">
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </Card>
              ))}
            </div>
          </div>
        </AppSection>

        <AppSection>
          <Card className="grid gap-6 bg-[color:var(--surface-strong)]/86 p-6 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-3">
              <Badge tone="primary">当前版本说明</Badge>
              <CardTitle className="text-2xl">
                P0 演示版，先验证完整闭环
              </CardTitle>
              <CardDescription className="max-w-4xl text-base leading-8">
                当前版本重点验证“实验任务 → 代码 → 运行结果 → 报告整理”的完整闭环。后续将支持上传实验要求文档、自动生成 Word 报告、失败自动修复代码等能力。
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <ButtonLink href="/demo" size="lg" tone="secondary">
                查看 Demo
              </ButtonLink>
              <ButtonLink href="/tasks/new" size="lg">
                开始创建任务
              </ButtonLink>
            </div>
          </Card>
        </AppSection>
      </AppFrame>
    </AppShell>
  );
}
