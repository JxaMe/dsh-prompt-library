# 调研：斜杠命令注册机制（2026-09-06）

结论：`/p` 这类真命令注册在 **Host 端 `ctx.commands.register()`**；Client 端 `ctx.commandUi` 只注册菜单弹窗表面，不产生命令本身。

## 1. 注册位置

- **Host**：`ctx.commands: CommandRuntime`，`packages/interaction/commands/src/index.ts:280`
  `register(definition): () => void`（返回 effect disposer，随 fiber 释放）。
  最简内置例：`/goal`（`packages/goal/command-goal/src/index.ts:189-195`）；
  `/plan` 用 `ctx.inject(['commands'], cb => ...)` 延迟挂载（`packages/plan/plan-mode/src/index.ts:224-268`）。
- **Client**（仅 UI 表面）：`ctx.commandUi`，`packages/client/ui-commands/src/client/service.ts:110 register()`（纯客户端命令，同名直接报错）/ `:128 decorate()`（挂在已存在宿主命令上的弹窗，不产新行）。约定见 `src/client/contract.ts:76-86`。

## 2. 命令定义与 handler

- `CommandDefinition`（`interaction/commands/src/index.ts:60-75`）：`name`（`/^[a-z][a-z0-9_-]*$/`）、`description`（非空）、`input?: { hint, attachments? }`、`recordInput?`（默认 true）、`handler`。
- `CommandInvocation`：`{ commandId, agent, rawInput, attachments, signal }`；`rawInput` 保留名称后全部字节，**无参数 schema，各命令自解析**。
- `CommandResult`：`{kind:'success', text?, sourceEventSeq?} | {kind:'error', text}`；非法返回抛 `TypeError`；handler 抛异常/被 abort → error 结算并记 `command/done`。
- handler 直接操作 `agent`，不产生模型消息；想让模型看见须显式 `agent.steer/followup/inject(...)`（如 `/plan` 带参即 steer）。
- **Host handler 不能**把文本填回输入框（无 composer API，那是 Client 特权），**不能**直接开弹窗。

## 3. 返回值渲染

- `execute()` 先记 `command/run`、后记 `command/done`（均为 log-only 会话事件），各端 ConversationNode 投影成 flow node。
- `success.sourceEventSeq` 可指向更早领域事件做富呈现。

## 4. 补全与动态列表

- `/` 菜单模糊搜是客户端行为：`candidates()` 合并 host 目录 + contributions，按 `rankByName`（有序子序列，前缀优先）排名。
- 动态列表走 `popupSelect`：`options()` 打开时加载**一次**，击键只过本地 `filterOptions`（label/detail 大小写不敏感子串），失败可 `retry()`。
- `/p` 裸调用弹动态列表 = Host 注册真命令 + Client `commandUi.decorate({name:'p', ui:{kind:'popupSelect', options, onSelect}})`（版式仿 `ui-permission-presets/src/client/index.ts:145-166`）。

## 5. Client 侧关键 API

- 插入草稿：`SessionInput.setDraft(text)`；作用域事件 `slash/input-insert-text { text, span, continue? }`；`slash/input-consume-token`、`slash/input-insert-reference`（`packages/client/ui-conversation/src/client/contract/input.ts`）。
- 程序化执行命令：`SessionFace.command(line)`（`api/session-controller/src/client/sessions/session.ts:371`）。
- 选后动作二选一：填草稿（可再编辑）或 `live.command('/p send <name>')` 回走 host 执行。

## 6. 外部包前置条件

- 函数插件形态：`export const name / inject / apply`，无 default export。
- `inject = ['commands', ...读写域服务]`；peerDep `cordis` + `dsh-commands`。
- 生效须进组合：bundle 的 `cordis.patch.yml` 加一行；Client 表面另需 client 包（`dsh.client` + `./client` 导出）。

## `/p` 最小 Host 骨架（仿 command-goal）

```ts
import type { Context } from '@deepseek-ai/cordis';
export const name = 'command-p';
export const inject = ['commands'];
export function apply(ctx: Context): void {
  ctx.commands.register({
    name: 'p',
    description: 'do P thing',
    input: { hint: '<args>' },
    handler: ({ agent, rawInput }) => {
      const args = rawInput.trim();
      if (!args) return { kind: 'error', text: 'Usage: /p <args>' };
      return { kind: 'success', text: `p: ${args}` };
    },
  });
}
```
