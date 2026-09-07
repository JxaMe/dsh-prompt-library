# 调研：dsh 生态提示词插件对比（2026-09-07）

结论：
1. **dsh 生态"提示词库/管理"类插件至少有 12 个**（npm 发布 8 个、GitHub-only 3 个、另有 1 个双入口项目），按路线分两派：**填输入框派**（面板选词/斜杠选词 → 插入正文）与**注入 system prompt 派**（选中后作为系统提示词参与后续请求）。我们（JxaMe/dsh-prompt-library）是唯一"命令直发 + 文本插入"双路线的。
2. **交接记录已过时**：本地留存的 dsh-prompt-manager 0.2.0–0.7.0 是 0.x 时代构建产物（从未发布到 npm，[registry 显示只发布过 1.4.1/1.5.0](https://registry.npmjs.org/dsh-prompt-manager)），当时确实与我们功能相近（同为 `/p` 命令 + storageDomain + 单 JSON 落盘路线，0.7.0 已含模板渲染与版本历史）；但 SaiSenBox 2026-08-15 以 1.4.1 重写发布，**彻底转向"会话级 system prompt 注入"**，npm 可见的全部版本（1.4.1/1.5.0）均无 `/p` 命令、无版本历史，且 `{{}}` 是**故意转义不渲染**（防 DSH 变量机制，[CHANGELOG 1.2.0](https://raw.githubusercontent.com/SaiSenBox/dsh-prompt-manager/main/CHANGELOG.md)）。"不渲染、无版本历史"对最新版仍成立，但"功能相近"的前提已不成立。
3. **我们的独家组合**：`/p` 全套命令（含 `send` 直发 + 变量渲染）、`@` 混排插入 + 拼音首字母搜索、`{{框架:react|vue}}` 下拉框渲染、可回滚版本历史、storageDomain 单 JSON 落盘——**没有任何竞品同时具备其中两项以上**（有版本历史的仅 @hyzyn/dsh-prompt 一家，且无命令/无变量/走注入路线）。
4. **对方有而我们没有的**：会话级注入与分支继承（SaiSenBox、sunjuntao、@wasd258 等 6 家）、多选注入（SaiSenBox）、**模型 tool**（@wasd258 的 `prompt_inject`、errorcode7 的 4 工具）、A/B 测试与导出分享（@hyzyn）、AI 优化/剪藏/生成 Skill/工作区绑定（sunjuntao）、装配可视化与 token 估算（errorcode7、Airrcat）。
5. **迭代建议**：① 值得做"会话级注入模式"（`/p send` 之外加注入选项，对齐生态主流用法）；② 值得做模型 tool（dsh 是 agent 平台，目前仅 2 家提供）；③ 没必要做 A/B 测试、剪藏、统计成就这类"大而全"功能（与我们的"单 JSON、纯文本、库+命令"定位冲突）。

## 1. 范围与方法

- 目标：dsh（DeepSeek Harness）生态的"提示词库/提示词管理（prompt manager / prompt library）"类插件；"提示词优化/润色/增强"类归入附录区分赛道。
- 渠道：npm registry 搜索 API（`text=dsh-prompt`、`text=prompt dsh`）、GitHub 仓库搜索（`dsh-prompt`、`dsh prompt plugin`）、社区列表（[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)、[AdamPlatin123/awesome-dsh-plugins](https://github.com/AdamPlatin123/awesome-dsh-plugins/blob/main/PLUGINS-ALL.md)）。
- 一手来源优先：npm registry API 与 tarball 源码、GitHub REST API（星数/时间/license）、raw README/源码；二手聚合站仅用于"发现"，不做功能结论依据。每条关键声明后附来源 URL；无法核实的标注"未证实"。
- 对比基准 = 我们的已实现功能（JxaMe/dsh-prompt-library v0.7.0，[README](https://github.com/JxaMe/dsh-prompt-library)，0 星，MIT，2026-09-07 最后提交）：
  1. `/p` 全套命令：增删改查、show、send 直发模型（变量渲染后作为 user message），支持中文名
  2. `@` 混排插入：输入框打 @ 选提示词插入正文，拼音首字母搜索
  3. 变量模板：`{{var}}` 发送时赋值；`{{框架:react|vue}}` 渲染成下拉框
  4. 管理面板：侧边栏 Tab（列表/搜索/原地改/版本历史/导入导出，Tab 宿主为 dsh-better-sidebar）
  5. 版本历史：每条提示词每次改正文自动存一版（默认 20 版），可回滚
  6. 存储：storageDomain 单 JSON 文件（`~/.dsh/storages/prompt_library.json`，prompts/usage/versions 三表）+ 拼音搜索

## 2. 同类清单（发现过程）

npm 发布中（按最后更新时间排）：

| 包 | 作者 | 最新版 | 最后发布 | 定位 |
|---|---|---|---|---|
| [@hyzyn/dsh-prompt](https://www.npmjs.com/package/@hyzyn/dsh-prompt) | hyzyn | 0.1.5 | 2026-09-05 | systemPrompt 版本管理 + A/B 测试 |
| [@sunjuntao/dsh-prompt-library](https://www.npmjs.com/package/@sunjuntao/dsh-prompt-library) | sunjuntao（GitHub: master1Sun） | 0.10.0 | 2026-08-31 | 词库管理 + AI 优化 + 剪藏（大而全） |
| [dsh-prompt-manager](https://www.npmjs.com/package/dsh-prompt-manager) | SaiSenBox | 1.5.0 | 2026-08-23 | 会话级 system prompt 注入的提示词库 |
| [dsh-prompt](https://www.npmjs.com/package/dsh-prompt) | FeatherHunter | 0.1.6 | 2026-08-22 | 24 条预制模板工具箱 |
| [@frog755/dsh-prompt-vault](https://www.npmjs.com/package/@frog755/dsh-prompt-vault) | Frog755 | 1.0.1 | 2026-08-22 | 输入框上方提示词库面板 |
| [@nelsonlongxiang/dsh-prompt-templates](https://www.npmjs.com/package/@nelsonlongxiang/dsh-prompt-templates) | nelsonlongxiang | 0.4.4 | 2026-08-22 | 全局/每会话模板 + 浮动面板 |
| [dsh-prompt-stash](https://www.npmjs.com/package/dsh-prompt-stash) | winered0v0 | 0.2.5 | 2026-08-19 | 每会话输入暂存栈（边缘同类） |
| [@wasd258/dsh-prompt-inject](https://www.npmjs.com/package/@wasd258/dsh-prompt-inject) | WASD258-jpg | 0.1.2 | 2026-08-15 | 每会话 system prompt 注入 + 模型 tool |
| [dsh-prompt-inject](https://www.npmjs.com/package/dsh-prompt-inject) | H1a3x | 0.1.0 | 2026-08-14 | 设置页模板库 + 工作区覆盖注入 |
| [dsh-prompt-presets](https://www.npmjs.com/package/dsh-prompt-presets) | zhangdong456 | 1.0.5 | 2026-09-03 | 设置页预设 + 一键注入草稿开头 |

GitHub-only（未发布 npm）：

| 仓库 | 作者 | 星 | 最后 push | 定位 |
|---|---|---|---|---|
| [master1Sun/dsh-prompt-library](https://github.com/master1Sun/dsh-prompt-library) | master1Sun | 9 | 2026-09-05 | = npm @sunjuntao/dsh-prompt-library（同一项目，双入口） |
| [errorcode7/dsh-prompt-manager](https://github.com/errorcode7/dsh-prompt-manager) | errorcode7 | 6 | 2026-08-14 | 系统提示词预设改写 + 装配流水线可视化 + 模型 tool |
| [Airrcat/dsh-yuzuha-prompts-manager](https://github.com/Airrcat/dsh-yuzuha-prompts-manager) | Airrcat | 2 | 2026-08-14 | 最简增删改 + 装配检查 |

撞名与包名占用：
- npm 上 `dsh-prompt-manager` 包名被 **SaiSenBox** 占用（[registry](https://registry.npmjs.org/dsh-prompt-manager)，latest 1.5.0）；GitHub 上另有 errorcode7/dsh-prompt-manager 与 Airrcat/dsh-yuzuha-prompts-manager（其 package.json name 也叫 `dsh-prompt-manager`）——**三个同名互不相关**，调研/安装时注意区分。
- `dsh-prompt-library` 这个 npm 包名曾被发布（0.2.0）后于 2026-08-19 当天 **unpublish**（[registry](https://registry.npmjs.org/dsh-prompt-library) 的 `unpublished` 记录），目前无人占用。
- 同生态但非提示词管理类，确认排除：dsh-better-sidebar（[omdsh-dev/DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar)，3376 星，MIT）是侧边栏底座，我们的管理页 Tab 由它托管，非竞品。

## 3. 竞品逐一核实

### 3.1 dsh-prompt-manager（SaiSenBox）— 会话级注入路线，npm 同名占用者

- 作者 SaiSenBox；[GitHub SaiSenBox/dsh-prompt-manager](https://github.com/SaiSenBox/dsh-prompt-manager) 7 星 / 1 fork；created 2026-08-15，pushed 2026-08-23；MIT；JavaScript。
- npm 只发布过 1.4.1（2026-08-15）与 1.5.0（2026-08-23）两版（[registry](https://registry.npmjs.org/dsh-prompt-manager)）；本地留存的 0.2.0–0.7.0 tgz 是 0.x 构建产物、从未上 npm。
- **版本脉络（交接记录核实）**：0.x（未发布）与我们同架构——`/p` 命令 + storageDomain 三表 + HTTP 路由；0.7.0 已含 [template.js](https://registry.npmjs.org/dsh-prompt-manager)（`{{var}}`/`{{a|b}}` 命令行赋值渲染）与 [versions.js](https://registry.npmjs.org/dsh-prompt-manager)（版本历史 cap 20、改名搬版本），交接记录"无版本历史、{{}} 不渲染"只对 0.2.0 等早期版本成立。1.4.1/1.5.0 **完全重写**：不再有 /p 命令与 storageDomain，改为 `ctx.systemPrompt.section` 注入 + 浏览器 localStorage 镜像到 `$DSH_HOME/dsh-prompt-manager/prompts.json`（[lib/index.js](https://registry.npmjs.org/dsh-prompt-manager/-/dsh-prompt-manager-1.5.0.tgz)）。
- **1.5.0 功能**（[README](https://raw.githubusercontent.com/SaiSenBox/dsh-prompt-manager/main/README.md) + [CHANGELOG](https://raw.githubusercontent.com/SaiSenBox/dsh-prompt-manager/main/CHANGELOG.md) + 源码）：设置→提示词管理（新建/编辑/删除/搜索/收藏/标签，候选按收藏+使用次数+最近使用排序）；composer 工具栏"提示词"按钮 + 选择器，**多选注入（每会话 ≤12 条）**；注入为会话级 system prompt（非聊天消息）；**分支继承**（fork 沿 parentSession 链继承，可单独增删）；`/prompt`、`/提示词`、`/关键词` 斜杠入口；JSON 导出/导入（merge/replace）；中英双语；4 条种子；存储 localStorage + 镜像 JSON（revision 冲突、corrupt 保留、原子写 0600）；**`{{}}` 故意转义为 `{ {`**（注入的是 systemPrompt，防 DSH 变量机制，CHANGELOG 1.2.0）。
- 与基准对比：1. /p 命令【无】（仅 client 斜杠选择器）；2. @ 混排+拼音【无】（`toLowerCase().indexOf()` 子串匹配）；3. 变量模板【无】（转义不渲染、无下拉）；4. 管理面板【部分】（DSH 设置页，非侧边栏 Tab）；5. 版本历史【无】；6. 单 JSON+拼音【部分】（localStorage+镜像文件双份，无拼音）。
- 它有而我们没有：**会话级注入、多选、分支继承、收藏+使用排序、双语 UI、localStorage 与文件双写**。

### 3.2 @sunjuntao/dsh-prompt-library（= master1Sun/dsh-prompt-library）— 功能最全的"大而全"竞品

- **同一项目双入口**：npm 包 `@sunjuntao/dsh-prompt-library` 的 repository/homepage 指向 [GitHub master1Sun/dsh-prompt-library](https://github.com/master1Sun/dsh-prompt-library)（9 星，MIT，master 分支）；`sunjuntao/dsh-prompt-library` 这个 GitHub 仓库不存在（404）。master1Sun 是 GitHub 作者，sunjuntao 是 npm 发布者。
- npm latest 0.10.0（2026-08-31，首发 08-19，44 个版本，近 30 天下载 7103）；GitHub 已到 v0.12.7（2026-09-05），0.12.x 未上 npm（[registry](https://registry.npmjs.org/@sunjuntao%2Fdsh-prompt-library)）。
- 功能（[README.zh.md](https://raw.githubusercontent.com/master1Sun/dsh-prompt-library/master/README.zh.md) + tarball 源码）：`/prompts` 命令族（-add/-tag/-s 检索/-enrich/-e 导出/-AI/-v/-h + 别名，大小写不敏感，**无 update/delete/show/send**）；`#` 光标前浮层实时筛选插入（**触发符是 # 不是 @**）；`{{var}}` 弹窗逐项填写 + 记忆上次值（**无 `{{a|b}}` 下拉语法**，[TemplateVariables.tsx](https://raw.githubusercontent.com/master1Sun/dsh-prompt-library/master/src/client/components/data/TemplateVariables.tsx)）；AI 智能完善（保存后 AI 提炼标题/标签/摘要）、自动学习剪藏（默认关）、**生成 DSH Skill 写盘 `~/.dsh/skills/`**、人格 SOUL.md、**会话级提示词注入**（session_prompts 表绑定会话/工作区/项目，0.9.5 起真正注入系统提示）、回收站软删除、统计看板/成就/每日日报；UI 形态：0.9.4 起移除右侧面板，改聊天框按钮弹窗 + 词库管理弹窗 + 设置面板（settings.section 插槽），0.12.1 表格行内编辑。
- **存储：SQLite**（node:sqlite）`~/.dsh/prompt-library/db/prompts.db`，表 prompts/tags/trash/meta/personas/session_prompts/usage_log/bindings 等——非单 JSON。
- 版本历史：npm 0.10.0【无】；master 0.12.x 新增 `pl_prompt_versions` 表（create/update/refine 自动快照）+ `GET /prompts/:id/versions` API，但三个主流 UI 组件均未调用 → **回滚 UI 未证实**（[routes.ts](https://raw.githubusercontent.com/master1Sun/dsh-prompt-library/master/src/host/routes.ts)）。
- 与基准对比：1. /p 命令【部分】（/prompts 族，无 update/delete/send）；2. @ 混排+拼音【无】（# 触发，子串匹配无拼音）；3. 变量模板【部分】（弹窗赋值，无下拉）；4. 管理面板【部分】（弹窗+设置面板，非侧边栏 Tab）；5. 版本历史【部分】（0.12.x 表+API，UI 未接）；6. 单 JSON+拼音【无】（SQLite、无拼音）。
- 它独有的：**AI 智能完善、剪藏、生成 DSH Skill、SOUL.md 人格、工作区/项目级绑定、回收站、统计看板**。

### 3.3 dsh-prompt（FeatherHunter）— 24 条预制模板工具箱

- 作者 FeatherHunter；[GitHub FeatherHunter/dsh-prompt](https://github.com/FeatherHunter/dsh-prompt) 6 星 / 6 issues；created 2026-08-16，pushed 2026-08-22；MIT；TypeScript；npm 0.1.0→0.1.6（[registry](https://registry.npmjs.org/dsh-prompt)）。
- 功能（[README](https://github.com/FeatherHunter/dsh-prompt) + [src/client/](https://github.com/FeatherHunter/dsh-prompt/tree/main/src/client)）：24 条预制深度模板（领域×阶段×动作体系）；三种入口（⚡按钮面板、`/prompt` 触发源、智能悬浮卡）；智能推荐引擎（专属词×2+通用词×1、门限≥2、候选≤3、代码块内降权）；自定义模板增删改（弹窗、上限 1000 字）、预制可"复制为自定义"、置顶≤5、用量排序；设置页管理；中英双语。
- 存储：**纯浏览器 localStorage**（`dsh.prompt.customs/usage/pinned/lastUsed`），host 半 no-op，无文件落盘。
- 与基准：命令【无】（/prompt 仅列出+过滤+插入正文）、@+拼音【无】（子串匹配）、变量【无】（"冒号表单式"模板，插入后光标定位到第一个 `：` 后）、管理面板【部分】（设置页）、版本历史【无】、单 JSON+拼音【无】。

### 3.4 @frog755/dsh-prompt-vault — 最简 JSON 落盘面板

- 作者 Frog755；[GitHub Frog755/dsh-prompt-vault](https://github.com/Frog755/dsh-prompt-vault) 3 星；created/pushed 08-22/08-26；MIT；原生 ESM 无构建。npm 真实包名是 **scoped 的 `@frog755/dsh-prompt-vault`**（无 scope 的 `dsh-prompt-vault` 404），latest 1.0.1（[registry](https://registry.npmjs.org/@frog755%2Fdsh-prompt-vault)）。
- 功能（[README](https://github.com/Frog755/dsh-prompt-vault) + [src/client.js](https://raw.githubusercontent.com/Frog755/dsh-prompt-vault/master/src/client.js)）：输入框工具行 📚 按钮 + 上方面板；点条目整条填入（setDraft 追加不覆盖）；新建/编辑/删除（二次确认）/搜索（子串匹配）；两条 seed。
- 存储：单 JSON 文件 `~/.dsh/prompt-library.json`（`DSH_PROMPT_VAULT_FILE` 可覆盖），格式 `{version, items:[{id,title,content,createdAt,updatedAt}]}`——**与我们同路径命名，格式字段不同**。
- 与基准：命令【无】、@+拼音【无】、变量【无】、管理面板【部分】（上方面板）、版本历史【无】、单 JSON+拼音【部分】（落盘✅、拼音❌）。

### 3.5 @hyzyn/dsh-prompt — systemPrompt 版本管理 + A/B 测试

- 作者 hyzyn；托管于 monorepo [hyzyn/dsh-plugin-kit](https://github.com/hyzyn/dsh-plugin-kit)（4 星，Apache-2.0，pushed 2026-09-06）的 packages/prompt；npm `@hyzyn/dsh-prompt` latest 0.1.5（2026-09-05，[registry](https://registry.npmjs.org/@hyzyn%2Fdsh-prompt)）。
- 功能（[README](https://raw.githubusercontent.com/hyzyn/dsh-plugin-kit/main/packages/prompt/README.md) + tarball 源码）：设置→插件卡片可视化编辑 systemPrompt；**每个 Prompt 多版本**（versions[] + activeVersionId，保存新版本/切换/回滚/标签备注）；**A/B 测试**（a/b 两版按权重随机注入，`GET /api/dsh-prompt/active` 查命中）；导出 JSON/Markdown、一键复制分享 JSON、JSON 导入；注入为**全局** systemPrompt 段（order 140，非会话级）；存储 `~/.dsh/prompts.yml` 托管区块（`DSH_PROMPT_FILE` 可覆盖）。
- 与基准：命令【无】、@+拼音【无】、变量【无】、管理面板【部分】（设置卡片）、**版本历史【有】**、单 JSON+拼音【部分】（YAML 托管区块、无拼音）。
- 注：竞品里除我们外**唯一有真正版本历史**的；另独有的 A/B 测试与导出分享。

### 3.6 @wasd258/dsh-prompt-inject — /prompt 命令 + 模型 tool + 单 JSON

- 作者 WASD258-jpg；[GitHub WASD258-jpg/dsh-prompt-inject](https://github.com/WASD258-jpg/dsh-prompt-inject) 2 星；npm 0.1.0/0.1.1/0.1.2（均在 08-15，latest 0.1.2，[registry](https://registry.npmjs.org/@wasd258%2Fdsh-prompt-inject)）；MIT。
- 功能（[README](https://registry.npmjs.org/@wasd258/dsh-prompt-inject) + tarball 源码）：`/prompt` 命令（status/list/?、use <id|none>、save、delete、default，**无 send 直发**）；**`prompt_inject` 模型 tool**（get/apply/save/delete/default，模型自己可管理库）；HTTP API（loopback + Host 防 DNS rebinding + 同源 Origin 三重防护）；输入框工具行「会话提示词」下拉（每 5 秒刷新）；设置页两区块（模板库 CRUD + 系统提示词分层只读查看器含 completeBlocksInjection 检测）；**会话级注入**（agent 作用域 section，仅顶层会话）；新会话默认模板；`{{model}}/{{cwd}}` 宿主插值。
- 存储：**单 JSON 文件 `$DSH_HOME/dsh-prompt-inject.json`**（templates/sessions/defaultTemplate，原子写 tmp+rename）。
- 与基准：命令【部分】（有 use/save/delete/default/status/list，无 send、save 要求名称是单个无空格 token）、@+拼音【无】、变量【部分】（仅宿主插值 {{model}}/{{cwd}}）、管理面板【部分】（设置页）、版本历史【无】、单 JSON+拼音【部分】（独立 JSON✅、拼音❌）。

### 3.7 errorcode7/dsh-prompt-manager — 系统提示词预设改写 + 模型 tool

- 作者 errorcode7；[GitHub errorcode7/dsh-prompt-manager](https://github.com/errorcode7/dsh-prompt-manager) 6 星；created/pushed 均 2026-08-14（建仓当天后无提交）；MIT；**npm 未发布**。
- 功能（[README](https://raw.githubusercontent.com/errorcode7/dsh-prompt-manager/main/README.md) + [index.js](https://raw.githubusercontent.com/errorcode7/dsh-prompt-manager/main/index.js)）：定位是"预设改写系统提示词"+装配流水线可视化，非提示词库；预设模型（replace/insert/remove 规则 × 段名 × 渲染位置）；挂 `system-prompt/assemble` waterfall；幕布 pipeline.html 全屏页展示 来源→覆盖→插值→最终；`agent/pre-step` 捕获真实快照保留 20 轮回看；**4 个模型 tool：switch_prompt / list_prompts / get_prompt / save_prompt**；存储 `$DSH_HOME/prompts/` 多 YAML（active.yml + 每预设一文件）；fs watch 热重载；`{{provider}}/{{model}}/{{cwd}}` 保留给 dsh 原生插值。
- 与基准：命令【部分】（4 个模型 tool，非 /p 斜杠、无 add/delete/show/send）、@+拼音【无】、变量【部分】（走 dsh 原生插值，无赋值交互/下拉框）、管理面板【部分】（设置页 tab）、版本历史【部分】（20 轮装配快照回看，非内容版本）、存储【部分】（多 YAML、无拼音）。
- 注：**唯一"装配流水线可视化"** 竞品；模型 tool 是本生态 2 家之一。

### 3.8 Airrcat/dsh-yuzuha-prompts-manager — 最简增删改 + 装配检查

- 作者 Airrcat；[GitHub Airrcat/dsh-yuzuha-prompts-manager](https://github.com/Airrcat/dsh-yuzuha-prompts-manager) 2 星；created/pushed 2026-08-14；MIT；npm 未发布；package.json name 也叫 `dsh-prompt-manager`。
- 功能（[README](https://raw.githubusercontent.com/Airrcat/dsh-yuzuha-prompts-manager/main/README.md) + [runtime.js](https://raw.githubusercontent.com/Airrcat/dsh-yuzuha-prompts-manager/main/lib/runtime.js)）：会话视图"提示词管理"标签页（conversation.view 槽位）：首次注入装配检查（`ctx.systemPrompt.assemble()` 真实模拟，段名/顺序/token 估算/变量表/工具 schema 体积）；增删改+启用禁用+上下排序；注入为 order 50 的 `user:prompt-manager` 段；**单 JSON 文件 `$DSH_HOME/prompt-manager/prompts.json`**；fs.watch 热重载 + client-hmr 500ms 轮询。
- 与基准：命令【无】、@+拼音【无】、变量【部分】（interpolateTolerant 装配期展示用）、管理面板【部分】（会话视图标签页）、版本历史【无】、单 JSON+拼音【部分】（单 JSON✅、拼音❌）。

### 3.9 @nelsonlongxiang/dsh-prompt-templates — 全局/会话模板 + 浮动面板

- 作者 nelsonlongxiang（npm maintainer yuanguang）；[GitHub NelsonLongxiang/dsh-prompt-templates](https://github.com/NelsonLongxiang/dsh-prompt-templates) 3 星，push 2026-08-29；npm 版本仅 0.2.8/0.2.9/0.2.10/0.4.4（latest 0.4.4，2026-08-22，[registry](https://registry.npmjs.org/@nelsonlongxiang%2Fdsh-prompt-templates)）；MIT。
- 功能（tarball README + 源码）：**全局+会话级模板**（会话模板可一键转全局）；右侧浏览器浮动面板（shell.overlay）+ composer 工具行按钮；插入草稿（源码已实现**光标位置插入**，README"光标插入暂缓"已滞后）；**interject 插话**（steer 模式）；**send-now 立即发送**（setDraft+submit，无变量渲染）；搜索过滤（子串匹配）；global/session 标签页 + 分类 tab；拖拽定位。
- 存储：**node:sqlite 数据库 `$DSH_HOME/ext/prompt-templates/db.sqlite3`**（WAL、0600）；HTTP 路由 `/plugins/dsh-prompt-templates/*` **无 loopback 门禁**（代码未见回环校验）。
- 与基准：命令【无】、@+拼音【部分】（无 @ 语法，面板光标位置插入+搜索）、变量【无】、管理面板【部分】（浮动面板）、版本历史【无】、单 JSON+拼音【部分】（SQLite 非 JSON、无拼音）。

### 3.10 附录级（不展开）

- **dsh-prompt-inject（H1a3x，无 scope）**：设置页模板库 + 全局默认模板 + **按工作区覆盖**（跟随全局/不注入/指定模板）；注入 order 50；存储走 DSH settings 命名空间；1 星，唯一版本 0.1.0（2026-08-14，[registry](https://registry.npmjs.org/dsh-prompt-inject)）。与 @wasd258 版**不是同一作者**、两个独立项目。
- **dsh-prompt-presets（zhangdong456）**：设置页「提示词预设」管理 + composer 按钮一键注入草稿**开头**（preset+空行+原草稿，不自动发送）；存储 settings.yaml 命名空间；3 星，1.0.5（2026-09-03，[registry](https://registry.npmjs.org/dsh-prompt-presets)）。
- **dsh-prompt-stash（winered0v0）**：每会话 LIFO 暂存栈（≤10 条）+ Ctrl+S 快捷键，纯 localStorage；定位是输入暂存工具，非提示词库；3 星，0.2.5（2026-08-19，[registry](https://registry.npmjs.org/dsh-prompt-stash)）。

## 4. 对比矩阵

行 = 功能维度；列 = 各同类插件 + 我们。✅ 有 / △ 部分 / — 没有；"未证实"单独标注。

| 功能维度 | 我们 dsh-prompt-library | dsh-prompt-manager (SaiSenBox) | @sunjuntao/dsh-prompt-library | dsh-prompt (FeatherHunter) | @frog755/dsh-prompt-vault | @hyzyn/dsh-prompt | @wasd258/dsh-prompt-inject | errorcode7/dsh-prompt-manager | Airrcat/dsh-yuzuha-prompts-manager |
|---|---|---|---|---|---|---|---|---|---|
| 命令体系 | ✅ /p 全套（add/rm/rename/show/send/list） | △ 仅 client 斜杠选择器（/prompt、/提示词、/关键词） | △ /prompts 族（无 update/delete/send） | △ /prompt 仅列出+插入 | — | — | △ /prompt 全套（无 send） | △ 4 个模型 tool | — |
| 变量模板渲染 | ✅ {{var}} 发送时赋值 + {{a\|b}} 下拉框 | — 故意转义不渲染 | △ {{var}} 弹窗填写+记忆，无下拉 | — 冒号表单+光标定位 | — | — | △ 仅 {{model}}/{{cwd}} 宿主插值 | △ 走 dsh 原生插值 | △ 装配期展示 |
| 版本历史 | ✅ 每版快照+回滚（restore 再记一版） | — | △ 0.12.x 表+API，回滚 UI 未证实 | — | — | ✅ 多版本切换/回滚 | — | △ 20 轮装配快照（非内容版本） | — |
| 导入导出 | ✅ 整库 JSON 导出/导入（重名跳过） | ✅ JSON merge/replace | △ -e 导出等 | — | — | ✅ JSON/Markdown 导出+JSON 导入+分享 | — | — | — |
| @/提及插入 | ✅ @ 混排+拼音首字母 | — 工具栏按钮/斜杠 | △ # 浮层（非 @） | — ⚡按钮//prompt/悬浮卡 | — 📚按钮 | — | — 下拉 | — | — |
| 管理 UI | ✅ 侧边栏 Tab | △ DSH 设置页 | △ 弹窗+设置面板 | △ 设置页 | △ 上方面板 | △ 设置卡片 | △ 设置页两区块 | △ 设置页 tab | △ 会话视图标签页 |
| 存储方式 | ✅ storageDomain 单 JSON（三表） | △ localStorage+镜像 JSON | △ SQLite | △ localStorage（无文件） | △ 单 JSON（~/.dsh/prompt-library.json） | △ YAML 托管区块 | △ 单 JSON（dsh-prompt-inject.json） | △ 多 YAML | △ 单 JSON |
| 拼音/模糊搜索 | ✅ 拼音首字母+子串 | △ 子串匹配 | △ 子串匹配 | △ 子串匹配 | △ 子串匹配 | △ 无 | △ 无 | △ 无 | △ 无 |
| 模型 tool | — | — | — | — | — | — | ✅ prompt_inject（get/apply/save/delete/default） | ✅ 4 工具（switch/list/get/save） | — |
| 工作区/项目级覆盖 | — 全局库 | — | △ 会话/工作区/项目绑定（session_prompts） | — | — | — | — | — | — |
| 多选 | — 单条插入/发送 | ✅ 每会话 ≤12 条多选注入 | — | — | — | — | — | — | — |
| 会话级注入 | — send 走 user message | ✅ systemPrompt.section+分支继承 | ✅ session_prompts 注入系统提示 | — 插入正文 | — 插入正文 | △ 全局 systemPrompt 段（非会话级） | ✅ agent 作用域 section | ✅ assemble waterfall（全局） | ✅ order 50 段 |
| 开源许可 | MIT | MIT | MIT | MIT | MIT | Apache-2.0（0.1.0 曾 MIT） | MIT | MIT | MIT |
| 活跃度 | 0.7.0，2026-09-07 提交，0 星 | 1.5.0，08-23，7 星 | npm 0.10.0/GitHub 0.12.7，09-05，9 星，月下载 7103 | 0.1.6，08-22，6 星 | 1.0.1，08-22，3 星 | 0.1.5，09-05，monorepo 4 星 | 0.1.2，08-15，2 星 | 无 npm，08-14 后停更，6 星 | 无 npm，08-14 后停更，2 星 |

## 5. 结论：独家差异 / 对方优势 / 迭代建议

### 我们的独家差异点（对方没有而我们有的）

1. **`/p` 命令 + `send` 直发模型**：唯一支持"命令式增删改查 + 渲染变量后作为 user message 直发"的插件；sunjuntao 有 /prompts 命令族但无 send，@wasd258 有 /prompt 但走注入不走 user message。
2. **`@` 混排插入 + 拼音首字母搜索**：唯一把提示词并入 `@` 提及菜单并支持拼音的（sunjuntao 用 `#`，其余是按钮/下拉/斜杠，全部子串匹配无拼音）。
3. **`{{框架:react|vue}}` 下拉框渲染**：所有竞品要么不渲染（SaiSenBox 转义、FeatherHunter 光标定位），要么只有纯文本弹窗赋值（sunjuntao）；下拉选项语法仅我们有。
4. **可回滚的版本历史**：有内容版本历史的仅 @hyzyn（走注入路线）；sunjuntao 0.12.x 只有快照表和 API、回滚 UI 未证实。
5. **storageDomain 单 JSON + 侧边栏 Tab 管理**：单文件整库拷走即备份；管理页形态（侧边栏 Tab + 原地改 + 双击插入）也是独一份（其余都在设置页/弹窗/浮动面板里）。

### 对方优势（我们缺的）

1. **会话级 system prompt 注入**（SaiSenBox、sunjuntao、@wasd258、H1a3x、errorcode7、Airrcat 共 6 家）：注入是 dsh 生态提示词库的主流用法——不污染聊天记录、对后续请求持续生效、支持分支继承（SaiSenBox）。我们只能插入正文或 send 一条 user message，无法"挂一个持续生效的提示词"。
2. **模型 tool**（@wasd258 的 `prompt_inject`、errorcode7 的 4 工具）：dsh 是 agent 平台，模型可自主调库（list/get/save）是自然延伸，我们没有。
3. **多选注入**（SaiSenBox，每会话 ≤12 条）、**收藏/置顶/使用排序**（SaiSenBox、FeatherHunter）、**A/B 测试与导出分享**（@hyzyn）、**AI 完善/剪藏/生成 Skill/工作区绑定**（sunjuntao）、**装配可视化与 token 估算**（errorcode7、Airrcat）。

### 差异化迭代建议

1. **值得做：会话级注入模式**（`/p send` 之外加 `/p inject <名称>` 或注入开关）。理由：6/9 家竞品都走注入路线，是生态主流用法；我们已有 storageDomain 与变量渲染，注入只是换一个发送目标（systemPrompt.section vs user message），改动可控；注入 + 变量渲染 + 版本历史组合后，我们在注入派里仍保持"变量下拉 + 回滚"的独家点。这是补齐最大缺口的最高性价比动作。
2. **值得做：模型 tool**（`prompt_library` 工具：list/get/add/save）。理由：dsh 是 agent 优先平台，只有 2 家竞品做了；我们的 HTTP API 与 storageDomain 已就绪，注册 2-3 个 tool 成本低；"模型能自己查库、用户能 /p 命令、能 @ 插入"三入口闭环是独一份。
3. **没必要做：A/B 测试、剪藏、统计成就、SOUL.md 人格**。理由：这些是"大而全"路线（sunjuntao）与注入特化路线（@hyzyn）的产物，与我们的"纯文本库 + 命令 + 单 JSON"定位冲突，会把 0.7.0 的小而美做成缝合怪；剪藏/AI 完善还引入 LLM 依赖与隐私面，偏离当前明确的差异化（命令、@、变量、版本）。

## 6. 其他平台参考（功能取舍参考，不参与主对比）

- **Claude Code**（官方文档 [memory](https://code.claude.com/docs/zh-CN/memory) / [.claude 目录](https://code.claude.com/docs/en/claude-directory.md)）：提示词资产是**文件化**的——CLAUDE.md（项目/用户/组织三级，每会话加载）、`.claude/rules/`（路径范围规则）、`.claude/commands/*.md`（单文件 prompt，`/name` 触发，支持 `$ARGUMENTS` 参数；`~/.claude/commands/` 为用户级全局）。`$ARGUMENTS` 对应我们的 `/p send k=v` 变量赋值；官方建议新命令优先做成 skill。
- **Cursor**（官方文档 [rules](https://cursor.com/docs/rules.md?raw=1)）：`.cursor/rules/*.mdc` 用 frontmatter（description/globs/alwaysApply）控制应用时机——Always Apply / Apply Intelligently（模型按相关性自取）/ Apply to Specific Files（glob）/ **Apply Manually（`@规则名` 提及）**。`@` 提及与我们的 `@` 混排插入同构；"Apply Intelligently"即 FeatherHunter 智能推荐的方向。
- 参考结论：CLI agent 靠"文件即提示词 + 作用域加载"，GUI 平台（dsh）需要"库 + 显式选择"；我们的 `@` 提及是 GUI 对 Cursor `@rule` 的对应物，值得在管理页里做成可引用的"规则"形态。

## 7. 发现但未入主表：prompt 优化/增强类（不同赛道）

搜索中另发现约 15 个"提示词优化/润色/增强"类插件，与"提示词库/管理"不同赛道（改草稿、非管理存量），主对比不含；代表性：[Fishsb/dsh-prompt-enhancer](https://github.com/Fishsb/dsh-prompt-enhancer)（66 星）、[dsh-prompt-optimizer](https://www.npmjs.com/package/dsh-prompt-optimizer)（2.0.3）、[dsh-prompt-sparkle](https://www.npmjs.com/package/dsh-prompt-sparkle)、[Y1X1n/dsh-prompt-optimizer](https://github.com/Y1X1n/dsh-prompt-optimizer)（11 星）、[DIAG5/dsh-better-input](https://github.com/DIAG5/dsh-better-input)（25 星，输入增强套件）。以及提示词周边：[Xilin3/dsh-prompt-persona](https://github.com/Xilin3/dsh-prompt-persona)（14 星，编辑 persona）、[Zzzzkd/dsh-prompt-rail](https://github.com/Zzzzkd/dsh-prompt-rail)（8 星，提示词快速跳转条）、[c4pt0r/dsh-prompt-rewrite](https://github.com/c4pt0r/dsh-prompt-rewrite)（持久改写规则）、[Moeblack/dsh-prompt-studio](https://github.com/Moeblack/dsh-prompt-studio)（编辑 system-prompt 段落实时预览）。
