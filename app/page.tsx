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
  "上传老师任务书和数据文件",
  "识别 task_book / dataset / source_code 等角色",
  "解析任务书并进行 AI 分析",
  "生成代码并真实运行",
  "生成真实运行截图和 Trace",
  "保留原模板导出 DOCX",
];

const capabilities = [
  {
    title: "原模板保护",
    description: "DOC/DOCX 作为老师原始模板，默认只追加填写内容，不重写封面、任务要求和说明。",
  },
  {
    title: "真实运行证据",
    description: "代码必须通过 run-code 真实执行，stdout、stderr、exitCode、runtime 都会进入证据链。",
  },
  {
    title: "真实截图",
    description: "命令行截图和网页效果截图都必须来自真实运行；缺失时明确标记【截图缺失】。",
  },
  {
    title: "可追踪流程",
    description: "工作台展示 Agent Trace、质量检查和导出状态，方便定位每一步是否完成。",
  },
];

const scenarios = [
  "Python 算法实验",
  "数据结构实验",
  "CSV 数据处理实验",
  "HTML/CSS/JS 页面实验",
  "老师模板填充交付",
];

export default function Home() {
  return (
    <AppShell>
      <AppFrame className="py-8 sm:py-10">
        <AppSection className="space-y-6 pt-0">
          <HeroPanel className="animate-rise">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div className="space-y-7">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="primary">实验任务 Agent</Badge>
                  <Badge tone="success">真实运行证据</Badge>
                  <Badge tone="accent">DOCX 原格式保护</Badge>
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">
                    Lab Report Assistant
                  </p>
                  <h1 className="font-display max-w-4xl text-4xl font-semibold leading-tight text-[color:var(--foreground)] sm:text-6xl">
                    从任务书到可复核 DOCX 交付，
                    <span className="block text-[color:var(--primary)]">
                      每一步都有真实证据。
                    </span>
                  </h1>
                  <p className="max-w-2xl text-base leading-8 text-[color:var(--muted)] sm:text-lg">
                    这不是普通 AI 聊天框。系统会识别上传材料、解析老师任务书、
                    生成并运行代码、保存真实截图，最后在原任务书对应位置追加内容并导出 DOCX。
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <ButtonLink href="/tasks/new" size="lg">
                    创建实验任务
                  </ButtonLink>
                  <ButtonLink href="/tasks" size="lg" tone="secondary">
                    查看我的任务
                  </ButtonLink>
                </div>
              </div>

              <Card className="bg-white/82">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      DELIVERY FLOW
                    </p>
                    <CardTitle className="mt-2">完整交付链路</CardTitle>
                  </div>
                  <Badge tone="success">可回归</Badge>
                </div>
                <div className="mt-5 grid gap-3">
                  {coreFlow.map((item, index) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-white/70 px-4 py-3 text-sm text-[color:var(--foreground-soft)]"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary-soft)] text-xs font-semibold text-[color:var(--primary)]">
                        {index + 1}
                      </span>
                      {item}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </HeroPanel>
        </AppSection>

        <AppSection>
          <SectionHeader
            eyebrow="Product"
            title="当前网站已经能做什么"
            description="围绕实验报告交付建立的垂直工作流：文件角色识别、文档解析、代码真实运行、截图证据、Trace、质量检查和 DOCX 原格式导出。"
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {capabilities.map((item) => (
              <Card key={item.title} className="space-y-3 bg-white/78">
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </Card>
            ))}
          </div>
        </AppSection>

        <AppSection>
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <SectionHeader
              eyebrow="Use Cases"
              title="适合的实验任务"
              description="优先服务有任务书、有代码、有运行结果或截图要求的课程实验。不伪造运行结果，也不自动提交学校系统。"
            />
            <Card className="bg-white/80">
              <div className="flex flex-wrap gap-2">
                {scenarios.map((scenario) => (
                  <Badge key={scenario} tone="neutral">
                    {scenario}
                  </Badge>
                ))}
              </div>
              <CardDescription className="mt-5 text-base leading-8">
                最终 DOCX 默认使用【代码】【运行结果】【运行截图】【结果分析】【问题及思考】
                等简洁中文标签，不会把“系统填写”写进交付文档。
              </CardDescription>
            </Card>
          </div>
        </AppSection>
      </AppFrame>
    </AppShell>
  );
}
