# dsh-prompt-manager 设计文档（v1）

> 状态：设计待确认。确认后按 §11 分阶段实现。调研依据见 `docs/00-research-*.md`。

## 0. 已定决策

| 问题 | 结论 |
|---|---|
| 管理对象 | 用户提示词库（可复用指令/模板），不管系统提示词/人设 |
| 使用入口 | 三平面并存：`/p`（命令平面：管理+直发+无头唯一入口）、`@`（输入平面：发现+粘贴）、侧边栏 Tab（管理页）。`/p` 不可砍：它是无 sidebar 用户的唯一管理口和无头环境的唯一使用口，保留成本为零 |
| 存储范围 | Harness home 全局（`~/.dsh` 下，所有工作区共用） |
| 代码位置 | 仓库外独立 npm 包，经 profile 挂载 |

## 1. 目标与非目标

目标（P0+P1 交付即完成）：

- `/p` 裸调用弹出提示词列表，选中即填入输入框草稿（可再编辑，不直接发送）。
- `/p list/show/send/add/rm/rename` 覆盖完整 CRUD，纯 Host 可用（无 Client 也能工作）。
- 数据落 `~/.dsh` 全局，进程重启不丢；坏数据大声报错，不静默丢。
- 与 DSH 集成方式和内置命令无差别：同一注册表、同一渲染（flow node）、同一会话日志（`command/run`/`command/done`）。

非目标（明确不做，扩展点见 §9）：变量模板 `{{var}}`、导入导出、工作区级覆盖、给模型用的 tool、管理面板、@提及触发。

## 2. 总体架构

```text
┌─ Web 页面 ─────────────────────────────┐  ┌─ Host（Node）──────────────────┐
│ Client 半（P1）                         │  │ Host 半（P0）                   │
│  src/client/index.tsx                   │  │  src/index.ts（插件入口）       │
│   commandUi.decorate('p', popupSelect)  │  │   ctx.commands.register(/p)     │
│     options() ─── GET ─┐                │  │   PromptStore（读写+校验）      │
│     onSelect() → 草稿插入 │                │  │   ctx.prompts（公开服务）       │
│                        │                │  │                               │
│  经 ctx.connection     │                │  │  数据面（二选一，见 §4）        │
└────────────────────────┼────────────────┘  │   settings 偏好 / storage 单据  │
         HTTP（同源可信） │                   └───────────────────────────────┘
         GET /prompt-library/api/prompts ──────┘
         （Host 用 ctx.webServer 注册，仿 better-sidebar）
```

关键分层（每层只干一件事）：

- `store`：唯一能碰持久化的人。CRUD + 校验 + 版本 + 写串行化。对外返回 `PromptRecord[]`，不抛裸错，只抛带 `code` 的 `PromptLibraryError`。
- `commands`：只做“解析输入 → 调 store → 返回 CommandResult”。不直接读写文件。
- `service`（`ctx.prompts`）：把 store 能力以服务面暴露，给未来扩展和其他插件用（仿 better-sidebar 暴露 `ctx.betterSidebar`）。
- `routes`（P1）：只读 HTTP 出口，供 Client 弹窗拉列表。写操作永远走 `/p` 命令，不走 HTTP（少一个写面就少一类并发和鉴权问题）。
- `client`（P1）：只做选择和插入，不持有数据、不做校验（校验是 Host 的事）。

## 3. 包与目录结构

包名：`dsh-prompt-manager`（3 段以内小写 recreational 前缀规则见仓库命名规范；发布前用 `dsh plugin add <git|npm>` 安装）。

```text
dsh-prompt-manager/
  package.json          # exports "." + "./client"；dsh.bundle.patch + dsh.client 声明
  cordis.patch.yml      # 单条 - insert: [{id: prompt-manager, name: dsh-prompt-manager}]
  tsconfig.json         # strict（见 §7）
  tsdown.config.ts      # 仅 P1 需要：复刻 lazy-CJS factory（banner/footer+externals）
  src/
    index.ts            # 插件入口：仅含 name/inject/Config/apply，无 default export
    config.ts           # Config schema + 默认值 + 失败即抛的校验
    types.ts            # 纯类型，无运行时代码
    errors.ts           # PromptLibraryError + code 联合类型
    store.ts            # PromptStore：加载/保存/CRUD/版本迁移/写串行
    commands.ts         # /p 注册 + 子命令解析（纯函数 parse，可单测）
    service.ts          # ctx.prompts 服务面（类型声明 + 工厂）
    routes.ts           # P1：GET /prompt-library/api/prompts（只读）
    context-types.ts    # declare module 扩展（ctx.prompts 类型）
  src/client/
    index.tsx           # Client 入口：仅含 inject/apply，无 name/Config
    prompt-popup.ts     # popupSelect 的 options/onSelect（拉列表→插入草稿）
    locales.ts          # 中文字典（locale-owned，不硬编码文案）
  docs/                 # 本目录：调研 + 设计 + 后续实现笔记
  tests/
    store.spec.ts       # CRUD/重名/越界/坏文件/版本迁移
    parse.spec.ts       # 子命令解析表测
```

文件纪律：`types.ts` 零运行时；Host 引用 client 内容一律 `import type`；跨文件值共享只经 `ctx.prompts` 服务，不直接 import store 实例。

## 4. 数据模型与存储

```ts
// src/types.ts（示意，字段冻结后即为 v1 契约；updatedAt 暂不需要——
// v1 无任何消费者读它，等排序/最近使用需求出现再加）
interface PromptRecord { name: PromptName; description: string; body: string }
type PromptName = Branded<string>; // 校验规则同命令名：/^[a-z][a-z0-9_-]*$/，与 /p 子命令共用一套
```

- 提示词数据 → **`ctx.storageDomain`**（推荐序第一，见调研 §7）：`DomainSpec{name:'prompt_library', version:1}`（注意：`UNIT_NAME_RE` 不允许横线，域名只能用下划线），单表 `prompts`，落盘文件 `prompt_library.json`。它是领域 durable 状态的官方数据面，有版本和后端路由；settings 是“配置”面，放会增长的列表不合适。
- 少量用户偏好（如 P1 的默认插入方式）→ `ctx.settings.installSection`，与数据分离。
- 越界保护（Config 可配，部署可改，不硬编码）：`maxNameLength`（默认 64）、`maxBodyChars`（默认 20000，返回前对完整 body 含包装计量）、`maxCount`（默认 500）。超限在 `add` 时拒绝并明说哪一项。
- 坏文件策略：JSON 解析失败或 schema 不符 → `open` 直接拒绝，挂载失败大声报错，**原文件原样不动**（不备份、不重置，用户可手工修复；storageDomain 的写链保证内存与介质不偏离）。
- 写串行：store 内一条 promise 链串行化所有写（单进程单 fiber，够用；跨进程并发不在 v1 保证内，文档写明）。

## 5. Host 设计（P0，纯 Host 即完整可用）

### 5.1 插件入口

```ts
// src/index.ts
export const name = 'dsh-prompt-manager';
export const inject = ['commands', 'storageDomain']; // 用到 webServer/settings 时再追加
export { Config } from './config.ts';
export function apply(ctx: Context, config: Config): void {
  const store = new PromptStore(ctx, config); // 内聚：加载+校验，失败即抛
  ctx.effect(() => ctx.commands.register(buildPromptCommand(ctx, store))); // 注册即 effect，卸载即注销
  // P1 再加：service.ts 注册 ctx.prompts；routes.ts 注册只读路由
}
```

无 `export default`（Loader 会丢弃命名空间，postmortem 0001）。若将来要兼容无命令组合，仿 plan-mode 用 `ctx.inject(['commands'], …)` 包裹。

### 5.2 `/p` 命令语义（子命令表，冻结即契约）

| 输入 | 行为 | 返回 |
|---|---|---|
| `/p` | P0：用法 + 列表摘要；P1：Client 弹窗接管（decorate），Host 行为不变 | success text |
| `/p list` | 名称 + description，一行一条，按名称排序 | success text（空库明示“空库”，不报错） |
| `/p show <name>` | 全文，原样返回（flow node 渲染） | success text / 不存在→error |
| `/p send <name>` | `agent.followup(createUserMessage(body))` 发给模型 | success 回执 / 不存在→error |
| `/p add <name> <正文…>` | 校验命名/长度/数量/重名（重名直接 error，不覆盖） | success 确认 / error 说明哪项 |
| `/p rm <name>` | 删除（不存在→error，不静默成功） | success 确认 |
| `/p rename <old> <new>` | 改名（目标已存在→error） | success 确认 |

解析规则：`rawInput` 自解析，首词为子命令；`add` 的正文取名称后全部字节（保留换行）；未知子命令/缺参一律 error 并附用法，不猜测。解析函数 `parsePromptArgs(rawInput): ParseResult` 为纯函数，closed union + `assertNever` 穷尽分支，表测覆盖。

`recordInput` 保持默认 true（命令进会话日志，可审计、可回放）。

## 6. Client 设计（P1，有它体验完整，无它功能完整）

- `src/client/index.tsx`：`inject = ['commandUi', 'locale', 'connection']`（最终按实际消费收敛，只声明真用的），`apply` 内 `ctx.effect(() => ctx.commandUi.decorate({name:'p', available:()=>true, ui:{kind:'popupSelect', options, onSelect}}))`（版式仿 ui-permission-presets）。
- `options()`：打开时 GET 只读路由拉一次全量（label=name，detail=description），失败给 `retry()`；击键过滤走本地 `filterOptions`，不每次请求。
- `onSelect()`：默认把 body 经 `slash/input-insert-text`（或 `SessionInput.setDraft`）填入草稿，**不发送**，用户可改后再发；若 settings 偏好为直接发送，则走 `SessionFace.command('/p send <name>')` 回走 Host（复用同一执行路径，不另写发送逻辑）。
- 文案全部走 locale 字典；组件样式自带，不引用其他插件的 chrome（purity gate 禁止值 import）。

## 7. TS 工程规范（强制）

- `strict: true` + `noUncheckedIndexedAccess` + `noImplicitAny`；剩余每个 `any` 写注释说明为何无法收窄。
- 所有导出函数显式返回类型；所有模块/导出写 JSDoc（`@param`/`@returns`），只写契约（行为/失败/时序/归属），不复述代码。
- 命名：不透明 ID 用 `Branded<>`；错误用带 `code` 联合的 `PromptLibraryError`，调用方按 `code` 分支，不 `instanceof` 猜测；closed union 末尾 `assertNever`。
- 开关判断用 discriminant tag，不用真值猜测；`catch` 只包一行语句并命名吞掉的东西。
- 可调即 Config：部署相关的数字/行为全部是校验过的 Config 字段，代码里不出现 `DEFAULT_*` 常量；协议常量和安全不变量才写死。
- 可选服务用 `ctx.get(name)`，声明的注入才用 `ctx.<name>`（postmortem 0001 教训）。
- 注释中文、简短、只写“为什么”；英文仅出现在标识符和对 DSH 上游概念的引用处。

## 8. 稳定性设计

- 启动失败大声化：存储损坏、Config 非法、重名注册，全部在 `apply` 或首次访问时抛，不带病运行。
- 注册即 effect：`commands.register` 返回的 disposer 进 `ctx.effect`，热重载/卸载不残留；只读路由同样随 fiber 释放。
- 读路径不抛：`list/get` 对“空/不存在”返回空或 error 结果，不抛异常；只有“数据坏了/配错了”才抛。
- 有界：所有对外返回在完整值上计量（`list` 只返回名称+描述天然有界；`show` 受 `maxBodyChars` 约束；`options()` 全量拉取受 `maxCount` 约束）。
- 无静默：`rm` 不存在、`add` 重名、`rename` 冲突全部明确 error，不存在“成功了但没生效”。

## 9. 扩展点（已做 vs 待做，2026-09-06 同步）

已落地（当初留缝，现已实现）：变量模板（`src/template.ts` + `/p send k=v` + 面板发送表单）、管理面板（侧边栏 Tab：增删改名、原地改正文、双击进草稿）、选中发送（弹窗装饰）、无 sidebar 降级（可选依赖，干净环境验证过）。

| 待做需求 | 预留位置 | 代价说明 |
|---|---|---|
| 导入导出 | `/p import <path>` / `/p export <path>` 两个子命令 + 面板两个按钮 | 解析表加行，store 加批量写入（复用同一校验），面板复用现有 POST 口径 |
| 工作区级覆盖 | store 改为双层合并（全局打底 + cwd 覆盖，仿 skill 注册表裁决） | 存储 spec 升级 version，需写迁移，命令行为不变 |
| 给模型用的 tool | 本包内 `ctx.tools.register('prompt_get')` | 附带 snapshot 测试成本，独立决策 |
| @提及触发 | `ui-input-trigger` 贡献 | 与 `/p` 共用 store + service |
| skill 托管（暂缓） | 本包做 `ctx.skills.registerProvider`，只收单文本 skill（多文件的继续放 `~/.dsh/skills/`）；`@` 做粘贴式插入 | 记录加调用策略字段，存储升 v2 写迁移；复用官方 skill 机制，不自建 tool |

## 10. 测试策略

- 单测（vitest，随包走，P0 必须）：`parse.spec.ts`（子命令表每一行+非法输入）、`store.spec.ts`（CRUD/重名/越界/坏文件备份/版本迁移/写串行）。
- 真实组合测试（P0 必须，按仓库测试政策精神）：用测试专用的最小 `cordis.yml` 经真实 Loader 启动（含 `commands` + `storageDomain` 最小组合），不断言模型，只断言 `/p list/add/show` 的 `CommandResult` 与落盘文件。不用手搭 `ctx.plugin(...)` 冒充。
- 手动验证清单（每次发版）：`dsh-web restart` → `/p list` → `/p add demo …` → `/p show demo` → `/p send demo` → 删掉 → 重启 dsh-web 数据仍在 →（P1）页面刷新后 `/p` 弹窗出现、选中填草稿。

## 11. 分阶段交付与验收

- **P0（先做）**：纯 Host：store + `/p` 全子命令 + 单测 + 真实组合测试 + 本机 profile 挂载验证。验收：无 Client 时所有子命令可用，重启不丢。
- **P1**：Client 弹窗 + 只读路由 + 草稿插入 + tsdown client 构建 + locale。验收：页面刷新后 `/p` 出列表，选中只填草稿不发送。
- **P2（按需）**：变量模板 + import/export。
- **P3（按需）**：管理面板。

## 12. 安装与验证（P0 capable）

```sh
dsh plugin --profile web add <包地址>   # 首选：自动处理 bundles + 包内 patch；或手动在 profile cordis.patch.yml 加行
dsh-web restart && dsh-web logs         # 新增 npm 包必须重启（live patch 只管文本热重载）
# 验证：页面 Refresh → 输入 /p list → 预期空库提示；/p add demo 你好 → /p show demo → 重启后仍在
```

包内 `cordis.patch.yml`（单条插入 + 防双挂，仿 better-sidebar）：

```yaml
- insert:
    - id: prompt-manager
      name: 'dsh-prompt-manager'
      disabled: !!js "[...ctx.loader.entries()].some((e) => e.options.name === 'dsh-prompt-manager' && e.options.id !== 'prompt-manager' && !e.disabled)"
```

## 13. 动手前待验证（实现阶段第一步，不猜）

已全部验证通过（P0 实现时逐条钉死）：

1. ✅ `ctx.storageDomain`：`DomainFacility.open(spec)` + `KvTable`（读内存同步、写链串行）。注意 `UNIT_NAME_RE` 禁横线。
2. ✅ `ctx.commands.register`：`CommandDefinition/Handler/Result` 精确形状（实现按 npm `0.1.2-rc.1` 的类型写，只用两边都稳定的字段：name/description/input.hint/handler、kind/text）。
3. ✅ `createUserMessage` 用法：抄扩展手册示例，组合测试用真实现跑通。
4. 包名 `dsh-prompt-manager` 在 npm/GitHub 无冲突（发布前查）。
5. 版本差：单测/组合测试跑在 npm `0.1.2-rc.1` 上，生产宿主是 `0.1.3-alpha.1`；所触表面经核对两边兼容（没碰改名的 `attachments/images` 字段）。真机挂载验证时复核。
6. 依赖策略（仿 better-sidebar）：`@deepseek-ai/*` 全走 peer（宿主解决），`zod` 走普通依赖（叶子库，结构互操作，不依赖跨副本身份）。
