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
  StepIndicator,
} from "@/components/ui";

const flow = [
  "上传任务书",
  "解析文本",
  "结构化 JSON",
  "用户确认",
  "生成代码",
  "运行代码",
  "编辑草稿",
  "导出 DOCX",
];

const principles = [
  {
    title: "用户确认优先",
    description: "AI 解析结果必须先展示给用户修改确认，确认后才进入代码生成。",
  },
  {
    title: "证据来自真实运行",
    description: "运行输出只来自后端 Python 子进程 stdout/stderr 或用户上传材料，不伪造截图。",
  },
  {
    title: "分步工作台",
    description: "生成代码、运行代码、生成报告草稿分成三个按钮，方便学习和纠错。",
  },
];

export default function Home() {
  return (
    <AppShell>
      <AppFrame className="py-8 sm:py-10">
        <AppSection className="space-y-6 pt-0">
          <HeroPanel className="animate-rise">
            <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
              <div className="space-y-7">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="accent">学习辅助工作台</Badge>
                  <Badge tone="primary">Python P0 闭环</Badge>
                  <Badge tone="success">用户确认后导出</Badge>
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[color:var(--accent)]">
                    Lab Report Workbench
                  </p>
                  <h1 className="font-display max-w-4xl text-5xl leading-[0.95] text-[color:var(--foreground)] sm:text-6xl xl:text-7xl">
                    实验报告自动化助手，
                    <span className="block text-[color:var(--primary)]">
                      从展示页升级为任务工作台。
                    </span>
                  </h1>
                  <p className="max-w-2xl text-base leading-8 text-[color:var(--muted)] sm:text-lg">
                    上传任务书后，系统先解析文本并生成结构化 JSON；用户确认后，再分步生成 Python 代码、运行代码、保存输出证据、编辑报告草稿并导出 DOCX。
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <ButtonLink href="/tasks/new" size="lg">
                    新建任务
                  </ButtonLink>
                  <ButtonLink href="/tasks" size="lg" tone="secondary">
                    我的任务
                  </ButtonLink>
                </div>

                <dl className="grid gap-4 border-t border-[color:var(--border)] pt-5 sm:grid-cols-3">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                      STATUS
                    </dt>
                    <dd className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
                      uploaded → exported
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                      CODE
                    </dt>
                    <dd className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
                      10 秒受限运行
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
                      SAFETY
                    </dt>
                    <dd className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
                      不代交不伪造
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-4">
                <Card className="bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,247,255,0.88))]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                        P0 Loop
                      </p>
                      <CardTitle className="mt-2">任务工作台</CardTitle>
                    </div>
                    <Badge tone="success">Ready</Badge>
                  </div>
                  <div className="mt-5 grid gap-3">
                    {flow.map((item, index) => (
                      <div
                        key={item}
                        className="rounded-[1.15rem] border border-[color:var(--border)] bg-white/75 px-4 py-3 text-sm text-[color:var(--foreground-soft)]"
                      >
                        <span className="mr-3 text-[color:var(--accent)]">
                          {String(index + 1).padStart(2, "0")}
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
            eyebrow="Workflow"
            title="一条清楚的学习辅助链路"
            description="本产品不是代写、代交、伪造作业系统。系统负责组织材料和生成草稿，最终内容必须由用户确认和编辑。"
          />
          <div className="mt-6">
            <StepIndicator
              steps={["上传", "解析", "确认", "生成/运行", "编辑", "导出"]}
              activeStep={1}
              completedSteps={1}
            />
          </div>
        </AppSection>

        <AppSection>
          <div className="grid gap-5 lg:grid-cols-3">
            {principles.map((item, index) => (
              <Card key={item.title} className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
                  0{index + 1}
                </p>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </Card>
            ))}
          </div>
        </AppSection>
      </AppFrame>
    </AppShell>
  );
}
