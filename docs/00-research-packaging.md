# 调研：Out-of-tree 双半插件规范（2026-09-06）

范例：`dsh-better-sidebar@0.18.0-alpha.0`（位于 `~/.dsh/profiles/web/node_modules/`）。
结论：外部包 = 一个 npm 包同时装 Host 半 + Client 半，靠 `dsh.bundle.patch` 挂 Host、靠 `dsh.client` 声明挂 Client。

## package.json 必备字段

- `"type": "module"` + `"main": "lib/index.js"` + `"types"`：Host 入口（Node ESM）。
- `"exports"`：必须含 `"."`（Host）和 `"./client"`（浏览器半）；可加 `"./invariant"`、`"./src/*"`、`"./package.json"`。
- `"dsh": {"bundle": {"patch": "./cordis.patch.yml"}, "client": {"platform": "web", "inject": [...]}}`
  - 无 `dsh.bundle` 声明的包只是普通依赖，`dsh plugin` 会警告且不激活。
  - `dsh.client.inject` 是包名边、仅信息性（preflight 展示/HMR 用），不决定激活顺序。
- `"files"` 覆盖所有运行时 import 与产物（`lib/*.js`、`lib/types/**`、`cordis.patch.yml`）。
- `peerDependencies` + `devDependencies` 镜像：`@deepseek-ai/cordis` 必在两者；dsh 对等依赖同样镜像。
- `"scripts.prepare": "tsdown"`：GitHub 安装时构建自包含产物（装的是源码非产物）；且 pnpm≥10 要求 profile 的 `pnpm-workspace.yaml` 的 `allowBuilds` 放行。

## 目录约定

- Host 半在 `src/` 根：`src/index.ts` 命名导出 `name` / `inject` / `Config` / `apply`，**无 default export**（否则 Loader `unwrapExports` 丢弃命名空间，见 postmortem 0001）。
- 浏览器半在 `src/client/`：`src/client/index.tsx` 导出 `inject` / `apply`（无 name/Config）。
- Host import 客户端内容一律 `import type`。
- 产物：`lib/index.js`（Host）+ `lib/client.js`（浏览器 lazy-CJS factory）+ `lib/client-*.js` 懒 chunk + `lib/types/**`。

## Client bundle 格式（lazy-CJS factory）

- 产物执行时只注册 factory、不跑副作用：`window.__ModuleLoader__.load({id, factory})`；CSS 等副作用在首次 import 物化时跑。
- `clientBundle(id, libEntry)`（`packages/client/tsdown.client.ts`）：Node 半 + 浏览器半双构建；externals = 基线（React/Cordis/store/ui-slots 等）+ 本包 `dsh.client.external`，其余一律 inline。
- 仓库外包需**自行复刻**此输出（自写 tsdown/rolldown 配置达到同等 banner + externals + 纯净门禁）。

## bundle-purity gate（`packages/client/tsdown.client.ts`，用例 `scripts/client-bundle-purity.spec.ts`）

- 禁止任何 `@deepseek-ai/*` **值 import**，白名单除外：基线模块表行、`cosmokit/schemastery`、`INLINE_SAFE` 纯 wire 层、`dsh-*/remote` 精确一层。
- 合法协作四条：① `import type`；② **cordis 服务**（client `inject` 服务名）；③ **slot**（`ctx.slots.register/inject`）；④ **Remote/transport**（`*/remote` 契约 + RPC）。

## profile 消费链路

- `dsh plugin --profile <name> add <pkg>`：① pnpm 装依赖；② 包有 `dsh.bundle` 则 append 到 `dsh.profile.bundles`；③ boot 按序合层（包内 `cordis.patch.yml` 的 `- insert:` 行）。
- profile 自有 `cordis.patch.yml` 是排 bundle 层之后的用户层。
- 防双挂：`disabled: !!js` 表达式在已有同名 entry 时退让。
- 新增 npm 包需**重启 dsh-web**（`dsh-web restart`，`patchReload: live` 只管补丁文本热重载）。

## Host 持久化 JSON 推荐序

1. **settings 命名空间**（用户可配偏好）：`ctx.settings.installSection(ctx, NS, Config, config, {...})`，用户层落 `~/.dsh/settings.yaml`。
2. **storage-domain KV**（领域 durable 状态）：`ctx.storageDomain`，json 后端每 unit 一文件（现场 `~/.dsh/storages/*.json`）。
3. 绝不直接 `node:fs` 写 `~/.dsh` 下自选路径（无并发/版本/后端路由契约，沙箱下可能被拦）。
