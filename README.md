# dsh-prompt-library

> DSH 的用户提示词库：存一次，`/p`、 `@`、管理页三处通用。常用指令不用再翻聊天记录，也不用反复手打。

![version](https://img.shields.io/badge/version-0.7.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![dsh](https://img.shields.io/badge/for-DeepSeek%20Harness-orange)

## 目录

- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [使用示例](#使用示例)
- [斜杠命令](#斜杠命令)
- [HTTP 接口](#http-接口)
- [配置](#配置)
- [数据在哪](#数据在哪)
- [FAQ](#faq)
- [贡献指南](#贡献指南)
- [许可证](#许可证)
- [致谢](#致谢)

## 功能特性

- 📝 **`/p` 全套命令**：增删改查、查看、直发模型，支持中文名，无头环境照常可用
- 🔍 **`@` 混排插入**：输入框打 `@` 加几个字，提示词和文件走同一菜单，支持拼音首字母，选中即粘贴正文
- 🧩 **变量模板**：正文写 `{{pr}}`，发送时赋值；`{{框架:react|vue}}` 还能变下拉框选
- 📊 **管理页**：列表、搜索、原地改、版本历史（一键恢复）、导入导出，常用自动置顶
- 💾 **单文件落盘**：整库一个 JSON，拷走即备份；统计与历史另表存放，老文件无缝兼容

## 快速开始

前置要求：本地装好的 DeepSeek Harness（`dsh-web` 能跑起来就行）。侧边栏插件（dsh-better-sidebar）可选——装了多一个管理页，不装完全不影响。

```bash
# 1. 安装进 web profile（会自动挂载，无需手改配置）
pnpm dsh plugin --profile web add <包地址>

# 2. 重启生效（页面会断一下重连）
dsh-web restart
```

然后在任意会话输入框里试：

```text
/p add 每日站会 今天完成了{{昨天}}，计划做{{今天}}，阻塞点{{阻塞}}

/p list
# 每日站会

/p send 每日站会 昨天=联调 阻塞=无
# → 渲染好的全文直接发给模型
```

## 使用示例

### 变量模板 + 下拉选项

```text
# 存一条带下拉的评审模板
/p add 评审 框架{{fw:react|vue|svelte}}，看{{pr}}，重点{{focus:性能|安全|可读性}}

# 命令行发送（空格的值加引号）
/p send 评审 fw=vue pr=12 focus="性能 安全"

# 缺了会点名，用错会纠正
/p send 评审 pr=12
# missing variables for "评审": fw, focus. usage: /p send 评审 fw=... focus=...
```

### `@` 插入

```text
# 输入框打 @ 加几个字（拼音首字母也行）
@bszn
# → 菜单出现“部署指南”，选中即把正文填进输入框，只填不发
```

### 管理页

装了侧边栏插件后，`+` 菜单里多个**提示词**页：搜索、新增、改名、原地改、发送（含变量表单与渲染预览）、克隆、历史版本恢复、导入导出、双击行插入输入框。

### 导入导出

管理页底部**导出**即下载整库 JSON；**导入**选文件即可，重名逐条跳过并告诉你原因，永不覆盖。

## 斜杠命令

| 命令 | 说明 |
|---|---|
| `/p` 或 `/p list` | 列出全部（常用置顶） |
| `/p show <名称>` | 查看正文 |
| `/p send <名称> [k=v ...]` | 渲染变量后发给模型 |
| `/p add <名称> <正文…>` | 新增（重名拒绝，不覆盖） |
| `/p rm <名称>` | 删除 |
| `/p rename <旧> <新>` | 改名（版本历史一起搬） |

名称规则：可用中文、大小写、符号；唯独**空格、`=`、`"`不行**（命令分词和赋值语法要用它们）。长度、条数、正文大小见[配置](#配置)。

## HTTP 接口

前缀均为 `/prompt-library/api`，只认回环与受信 Host。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/prompts` | 目录（含使用统计，不含正文） |
| GET | `/prompts/<名称>` | 单条全文 |
| GET | `/prompts/<名称>/versions` | 历史版本（rev 倒序） |
| GET | `/prompts/export` | 整库导出 `{version, prompts}` |
| POST | `/prompts/add` | 新增 `{name, description?, body}` |
| POST | `/prompts/remove` | 删除 `{name}` |
| POST | `/prompts/rename` | 改名 `{from, to}` |
| POST | `/prompts/update` | 改内容 `{name, description?, body?}` |
| POST | `/prompts/restore` | 恢复某版 `{name, rev}`（会再记一版，可撤销） |
| POST | `/prompts/import` | 批量导入 `{prompts: [...]}`，返回 `{added, skipped}` |

```bash
# 读目录
curl http://127.0.0.1:3080/prompt-library/api/prompts
# {"prompts":[{"name":"每日站会","description":"","useCount":3,"lastUsedAt":1788712602264}]}
```

## 配置

在 profile 的 `cordis.patch.yml` 里覆盖（一般不用动，默认即够用）：

```yaml
- id: prompt-manager
  name: 'dsh-prompt-library'
  config:
    maxNameLength: 64     # 名称最大长度
    maxBodyChars: 20000   # 正文最大字符数
    maxCount: 500         # 最多存几条
    versionHistory: 20    # 每条留几个历史版本，0 为关闭
```

| 字段 | 默认 | 说明 |
|---|---|---|
| `maxNameLength` | `64` | 超长拒绝 |
| `maxBodyChars` | `20000` | 超长拒绝 |
| `maxCount` | `500` | 存满拒绝新增 |
| `versionHistory` | `20` | 每次改正文自动存一版，超数剪最旧的 |

## 数据在哪

`~/.dsh/storages/prompt_library.json`，一个文件装全部：`tables.prompts` 是正文，`tables.usage` 是使用统计，`tables.versions` 是历史。备份拷这一个文件就行；文件坏了插件启动即报错，**原文件不动**，修好重进即可。

## FAQ

**没装侧边栏插件能用吗？**
能。`/p`、弹窗、`@` 照常，少个管理页而已（已在干净环境验证过）。

**和 skill 有什么区别？**
skill 是给模型按需加载的任务指令（多文件、可远程）；这是给你自己用的提示词库（单文本、全局、带管理界面）。以后可能让库里的单文本 skill 也进 skill 注册表，目前还没做。

**变量值里有空格怎么办？**
加双引号：`/p send 评审 focus="性能 安全"`。值里不能有双引号本身（v1 没转义）。

**删掉的能找回来吗？**
删除是真删。但**改内容**都会留版，去历史里恢复；删之前建议先导出备份。

## 贡献指南

欢迎提需求和修 bug（中文就行）：

```bash
git clone <本仓库> && cd dsh-prompt-library
npm install --include=dev
npm test          # 全量测试，红了不许提交
npm run typecheck # Host/Client 双编译面都要干净
```

- 加行为先加测试（红→绿），修 typo 和文档除外。
- 对外行为变化（命令、接口、存储格式）同步更新本 README 和 `docs/01-design.md`。
- 版本号：修 bug 不动号，加功能进一位（0.7→0.8），破坏性变更进 1.0。

## 许可证

[MIT](LICENSE)（待补充 LICENSE 文件，暂按 MIT 处理）。

## 致谢

- [dsh-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar)：管理页的 Tab 宿主，`registerTab` 契约干净，联调顺利。
- [pinyin-match](https://www.npmjs.com/package/pinyin-match)：拼音首字母搜索，多音字都对。
- DeepSeek Harness 的 skill/command/input-trigger 三套扩展点——这个插件基本是照着它们拼出来的。
