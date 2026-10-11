<p align="center">
  <img src="docs/icon.svg" width="168" height="168" alt="arch-motion-page 图标：一页正在播放架构动画的 A4 纸">
</p>

<h1 align="center">arch-motion-page</h1>

<p align="center">
  <b>一个 Agent Skill：把系统架构编译成一页会动的 A4 架构蓝图。<br>一份小小的 YAML spec，同时产出可交互的 HTML、海报 PNG 和 MP4 视频。</b>
</p>

<p align="center">
  <a href="README.md">English</a> · <b>简体中文</b>
</p>

<p align="center">
  <a href="https://joeeeeey.github.io/arch-motion-page/zh.html"><img alt="在线演示" src="https://img.shields.io/badge/在线演示-打开页面-ec4899"></a>
  <img alt="Claude Code skill" src="https://img.shields.io/badge/Claude_Code-skill-d97757">
  <img alt="GSAP 3.15" src="https://img.shields.io/badge/motion-GSAP_3.15-0ae448">
  <img alt="HyperFrames" src="https://img.shields.io/badge/video-HyperFrames-3b6ff5">
  <img alt="Node 22+" src="https://img.shields.io/badge/node-%E2%89%A522-339933">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue"></a>
</p>

<p align="center">
  <img src="docs/demo-zh.webp" width="860" alt="示例页面的动画：总导演卡片脉动，信号包沿连线流向六个专家卡片，卡片在信号到达时放大，最后交接汇入共享底座">
</p>

<p align="center">
  <sub>示例页面用 amp 自己的流水线来介绍 amp，由这个 skill 构建并渲染。<br>
  ▶ <a href="https://github.com/joeeeeey/arch-motion-page/releases/download/v0.1.0/amp-self-intro-zh.mp4">中文 MP4（24 秒）</a> ·
  <a href="https://github.com/joeeeeey/arch-motion-page/releases/download/v0.1.0/amp-self-intro.mp4">English MP4</a> ·
  <a href="https://joeeeeey.github.io/arch-motion-page/zh.html">中文 HTML</a> ·
  <a href="https://joeeeeey.github.io/arch-motion-page/">English HTML</a></sub>
</p>

---

## 它能做什么

把一个系统描述清楚：入口是谁，它把工作分派给哪些角色或服务，它们共享什么、产出什么。**amp**（arch-motion-page）会把它排成一页学术风格的 A4 页面，包括页眉、品牌栏、三层架构图和三栏正文，然后让它动起来：

- **约 3 秒完成自我构建。** 之后循环播放一段“心跳故事”：根节点脉动，信号包沿连线传递，每个工作卡片在信号到达时放大，最后交接汇入底座。
- **构建完成后的任意一帧都能直接当海报。** 连线上的虚线在流动，吉祥物轻轻晃动，霓虹渐变字标在呼吸。
- **一份 spec，三种产出。**
  - 可交互的 HTML 页面：演示模式、键盘控制、单文件发布。
  - 海报 PNG。
  - 由 [HyperFrames](https://www.npmjs.com/package/hyperframes) 渲染的 MP4。
- **Agent 只写 YAML。** 所有坐标、颜色和关键帧都由确定性的编译器生成。不读系统时钟，也没有未播种的随机数，所以 `t = 12.5 s` 这一帧在浏览器里和在视频里完全一致。
- **先审再渲染。**
  - 运行时 fit report 会标出溢出的文字和栏位。
  - 审阅脚本按故事事件截帧。
  - 评分表指导“改 spec → 重建 → 再审”的循环。
- **中英文都支持**（`meta.lang: zh`）。Noto SC 字体按版本锁定，并按页面用到的字符做子集化。
- **两套皮肤**：白纸黑字的 `plush-academic`（默认）和深蓝的 `blueprint`。

| 白纸（默认） | 中文 | Blueprint |
|:---:|:---:|:---:|
| <a href="https://joeeeeey.github.io/arch-motion-page/"><img src="docs/poster-en.png" width="270" alt="英文海报帧"></a> | <a href="https://joeeeeey.github.io/arch-motion-page/zh.html"><img src="docs/poster-zh.png" width="270" alt="中文海报帧"></a> | <a href="https://joeeeeey.github.io/arch-motion-page/blueprint.html"><img src="docs/poster-blueprint.png" width="270" alt="Blueprint 皮肤海报帧"></a> |

<sub>点击海报即可打开对应的在线页面。</sub>

## 对话示例

安装好 skill（见下文）后，直接用自然语言提需求就行。分析、写 spec、构建、审阅、渲染都由 skill 引导完成。

**中文对话**

> **你：** 用 arch-motion-page 把我们的 RAG 问答系统做成一页会动的 A4 架构图，要中文版。
>
> **Claude：** 我按三层来拆：
> - **根节点**：问答编排器。
> - **工作节点**：检索、重排、生成、引用校验。
> - **底座 → 结果**：向量库、文档仓库 → 可信回答。
>
> 另外加了一条“用户反馈 → 编排器”的虚线反馈边。spec 写在 `/tmp/amp-rag/spec.zh.yaml`（`meta.lang: zh`），已经构建并审过帧：fit report 通过，三栏填充 92 / 95 / 90 %。打开 `out-zh/index.html` 就能看到循环动画。
>
> **你：** 再给我一个能直接发给同事的单文件 HTML。
>
> **Claude：** 已经加 `--single` 重新构建，输出 `out-zh/single/amp-rag-zh.html`，脚本、字体子集和图片都内联在这一个文件里，离线也能打开。按 F 键可以整页适配窗口。

**English conversation**

> **You:** Use arch-motion-page to make an animated A4 page for our checkout system. The API gateway fans out to cart, pricing, payment and fulfilment; they share Postgres and Kafka, and the outcome is a confirmed order.
>
> **Claude:** I split it into three tiers:
> - **Root:** API Gateway.
> - **Workers:** Cart · Pricing · Payment · Fulfilment.
> - **Substrate → outcome:** Postgres · Kafka → Order confirmed.
>
> I also added a dashed feedback edge for refunds back to the gateway. I wrote `/tmp/amp-checkout/spec.yaml`, built it and reviewed the frames. The fit report is OK and the columns fill 93 / 96 / 91 %. Shall I render the MP4?
>
> **You:** Make the Payment card say "3DS + retries", try the blueprint skin, then render.
>
> **Claude:** I updated the spec, rebuilt with `--theme blueprint` and re-reviewed. HyperFrames lint, check and render ran inside Docker, and the result is in `out/renders/amp-checkout.mp4` (24 s).

## 安装

环境要求：
- **Node.js ≥ 22**
- **Google Chrome 或 Chromium**，用于审阅截图。如果不在标准位置，用 `CHROME=/path` 指定。
- **Docker**，用于渲染 MP4，也用于中文字体子集化（中文页面和 `--single` 构建）。HyperFrames 和 fonttools 都只在容器里运行，不会装到宿主机上。

```bash
# Claude Code：个人 skill（所有项目可用）
git clone https://github.com/joeeeeey/arch-motion-page ~/.claude/skills/arch-motion-page
cd ~/.claude/skills/arch-motion-page && npm install
```

想和团队共享，就克隆到项目的 `.claude/skills/arch-motion-page`。其他支持 `SKILL.md` 格式的 agent，把同一个目录放进它们自己的 skills 目录即可。

## 快速上手（不经过 agent）

```bash
node scripts/build.mjs examples/self-intro/spec.zh.yaml          # 中文版 -> examples/self-intro/out-zh/
open examples/self-intro/out-zh/index.html                       # 自动播放、居中；Space / F / ← → / Home
node scripts/review.mjs examples/self-intro/out-zh               # 截帧、联系表、fit report
node scripts/build.mjs examples/self-intro/spec.yaml             # 英文版 -> out/
node scripts/build.mjs examples/self-intro/spec.zh.yaml --single # 单个自包含文件 -> out-zh/single/
scripts/render.sh examples/self-intro/out-zh                     # 在 Docker 里用 HyperFrames 渲染 MP4
```

几个一次性的准备步骤，之后只需几秒加上渲染本身的时间：
- 第一次构建中文页或 `--single`：创建一个小的 fonttools 镜像，并下载锁定版本的 Noto SC 字体。
- 第一次渲染：创建 HyperFrames 镜像（Debian、ffmpeg 和 headless Chrome）。

## 工作原理

```
spec.yaml ─▶ lib/spec.mjs                  校验、字数预算（中文字符按 2 计）
          ─▶ lib/archetypes/tiered.mjs     盒子、连线、信号包路径
          ─▶ templates/paper-a4.mjs        HTML + themes/<name> 的 CSS
          ─▶ lib/motion.mjs                JSON 动作列表（构建动画、故事节拍、环境循环）
          ─▶ runtime/amp-runtime.js        唯一一条暂停的 GSAP 时间线 + fit report
          ─▶ out/index.html                同时也是合法的 HyperFrames composition
```

页面把时间线注册到 `window.__timelines[id]`。在 HyperFrames 下，时间线保持暂停，由 HyperFrames 逐帧 seek。给人看时，同一个文件以*演示模式*自动播放：
- **播放**：构建动画只播一次，之后无缝循环播放“心跳故事”。循环的首尾是同一帧，所以看到一半时页面不会突然回到空白重来。
- **布局**：居中放在桌面背景上，并按窗口缩放。
- **按键**：`Space` 播放/暂停，`F` 整页适配，`←` `→` 步进 1 秒，`Home` 重播构建动画。
- **查询参数**：`?once`（只播一次并停在最后一帧）、`?poster`、`?t=12.5`、`?fit`、`?debug`。
- **减弱动效**：`prefers-reduced-motion` 会停在海报帧。

建议先读 **[SKILL.md](SKILL.md)**（agent 遵循的工作流），再读 **[references/spec-schema.md](references/spec-schema.md)**（spec 的每个字段）。新皮肤、新版式、新语言和新动效见 **[references/extending.md](references/extending.md)**。

## 目录结构

| 路径 | 内容 |
|---|---|
| `SKILL.md` | Skill 入口：硬性规则、工作流、命令、常见坑 |
| `lib/` | spec 加载、三层版式、动效编译、图标、语言、字体流水线 |
| `templates/`、`themes/` | 页面几何与 HTML；`plush-academic` 和 `blueprint` 两套皮肤 |
| `runtime/amp-runtime.js` | 动作计划解释器、播放模式、fit report |
| `scripts/` | `build.mjs`、`review.mjs`、`render.sh`（Docker）、`slice_cast.py`（切分吉祥物图） |
| `references/` | spec 字段、设计与动效语法、评审标准、扩展指南 |
| `examples/self-intro/` | 演示里那一页：amp 介绍 amp，中英两版 |
| `vendor/fonts/` | Tinos、Inter、JetBrains Mono（SIL OFL 1.1） |
| `docs/` | README 用到的素材：图标、演示动画、海报帧 |

## 致谢与许可

- **代码与文档**：[MIT](LICENSE)。
- **字体**：
  - Tinos、Inter、JetBrains Mono 以 SIL Open Font License 1.1 随仓库分发，许可文本在 `vendor/fonts/`。
  - Noto Serif SC / Noto Sans SC（OFL）在构建时下载，用 sha256 锁定版本。
- **[GSAP](https://gsap.com)**：npm 依赖，遵循其 [Standard License](https://gsap.com/standard-license)。源码中不内置 GSAP；构建出的页面（包括 `gh-pages` 分支上的演示页）会按该许可内嵌它。
- **[HyperFrames](https://www.npmjs.com/package/hyperframes)**：渲染时在容器内安装。
- **示例中的毛绒吉祥物**：由图像模型生成，提示词保存在 `examples/self-intro/assets/source/`。

详见 [NOTICE.md](NOTICE.md)。
