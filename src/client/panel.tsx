import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { PROMPT_NAME_RE } from '../library.js'
import { extractVariables } from '../template.js'
import { appendToDraft } from './draft.js'
import type { DraftInput } from './draft.js'
import { submitSendLine } from './decorate.js'
import { addPrompt, buildSendLine, exportLibrary, getPromptDetail, importLibrary, listPrompts, removePrompt, renamePrompt, sortSummaries, updatePrompt } from './prompts.js'
import type { PromptSummary } from './prompts.js'
import type { PromptTabDescriptor } from './sidebar-faces.js'
import type { PanelHost } from './sidebar-faces.js'

/**
 * 提示词管理页：列表、新增、删除、改名。数据与 /p 同一个库，
 * 两边读写实时一致（改完重拉）。服务端是最终校验，页面的
 * 名称预检只是少跑一趟的 UX。
 */
export function promptTab(): PromptTabDescriptor {
  return {
    id: 'prompt-manager:library',
    title: '提示词',
    icon: (size: number): ReactNode => <span style={{ fontSize: size, lineHeight: 1 }}>词</span>,
    single: true,
    component: PromptPanel,
  }
}

const row: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #8883' }
const input: CSSProperties = { flex: 1, minWidth: 0, background: 'transparent', color: 'inherit', border: '1px solid #8885', borderRadius: 4, padding: '4px 8px', fontSize: 13 }

function PromptPanel(props: PanelHost): ReactNode {
  const [items, setItems] = useState<readonly PromptSummary[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [body, setBody] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameTo, setRenameTo] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [editBody, setEditBody] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  const [sendVars, setSendVars] = useState<readonly string[]>([])
  const [sendValues, setSendValues] = useState<Readonly<Record<string, string>>>({})
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')

  /** 可见行：先按查询过滤（名称+说明，大小写不敏感），再按常用排序。 */
  function visibleItems(): PromptSummary[] {
    const q = query.trim().toLowerCase()
    const filtered = q === ''
      ? items
      : items.filter((item) => item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q))
    return sortSummaries(filtered)
  }

  const reload = useCallback(async (): Promise<void> => {
    try {
      setItems(await listPrompts())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  async function run(action: () => Promise<unknown>): Promise<void> {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  /** 导出整库为 JSON 文件下载。 */
  async function exportFile(): Promise<void> {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const file = await exportLibrary(globalThis.fetch)
      const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }))
      try {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = 'prompt-library.json'
        anchor.click()
        setNotice(`已导出 ${file.prompts.length} 条`)
      } finally {
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  /** 读用户选的文件并导入。JSON 坏了直接报，不碰库。 */
  async function importFile(chosen: File | undefined): Promise<void> {
    if (chosen === undefined) return
    let data: unknown
    try {
      data = JSON.parse(await chosen.text()) as unknown
    } catch {
      setError('文件不是合法 JSON')
      return
    }
    await run(async () => {
      const report = await importLibrary(globalThis.fetch, data)
      const skipped = report.skipped.map((row) => `${row.name}（${row.reason}）`).join('、')
      setNotice(`导入完成：新增 ${report.added.length}，跳过 ${report.skipped.length}${skipped === '' ? '' : `：${skipped}`}`)
    })
  }

  /** 打开编辑：先拉全文，再展开编辑区。失败只报错，不展开。 */
  async function openEditor(target: string): Promise<void> {
    setBusy(true)
    setError('')
    try {
      const detail = await getPromptDetail(globalThis.fetch, target)
      setRenaming(null)
      setEditing(target)
      setEditDescription(detail.description)
      setEditBody(detail.body)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  /** 双击行：把正文填进输入框草稿（只填不发）。按钮与输入区上的双击不触发。 */
  async function insertRow(item: PromptSummary): Promise<void> {
    setBusy(true)
    setError('')
    try {
      const detail = await getPromptDetail(globalThis.fetch, item.name)
      // get 的 string 重载返回 any，转一次即收敛到命名面（与 webServer 面同一处理）。
      const sessions = props.ctx.get('sessions') as { scope(id: SessionId): unknown } | undefined
      const conversation = props.ctx.get('conversation') as { input: { for(sessionScope: unknown): DraftInput } } | undefined
      if (!appendToDraft({ sessions, conversation }, props.scope.sessionId as SessionId, detail.body)) {
        setError('插入输入框失败：会话尚未就绪')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  /** 打开发送：无变量直接发，有变量展开填值表单。 */
  async function openSend(target: string): Promise<void> {
    setBusy(true)
    setError('')
    try {
      const detail = await getPromptDetail(globalThis.fetch, target)
      const variables = extractVariables(detail.body)
      if (variables.length === 0) {
        await submit(target, {})
        return
      }
      setEditing(null)
      setRenaming(null)
      setSending(target)
      setSendVars(variables)
      setSendValues(Object.fromEntries(variables.map((name) => [name, ''])))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  /** 经会话执行 /p send 行（与弹窗同一提交口）。 */
  async function submit(target: string, values: Readonly<Record<string, string>>): Promise<void> {
    const sessions = props.ctx.get('sessions') as Pick<ISessions, 'binding'> | undefined
    await submitSendLine(sessions, props.scope.sessionId as SessionId, buildSendLine(target, values))
  }

  async function add(): Promise<void> {    const trimmedName = name.trim()
    if (!PROMPT_NAME_RE.test(trimmedName)) {
      setError('名称不能为空，不能含空格、`=`、`"`')
      return
    }
    if (body.trim() === '') {
      setError('正文不能为空')
      return
    }
    await run(async () => {
      await addPrompt(globalThis.fetch, { name: trimmedName, description: description.trim(), body })
      setName('')
      setDescription('')
      setBody('')
    })
  }

  return (
    <div style={{ padding: '0 12px 12px', fontSize: 13 }}>
      <input
        style={{ ...input, width: '100%', marginBottom: 4 }}
        value={query}
        disabled={busy}
        onChange={(e) => setQuery(e.currentTarget.value)}
        placeholder="搜索名称或说明"
      />
      {visibleItems().map((item) => (
        <div
          key={item.name}
          style={row}
          title="双击插入到输入框"
          onDoubleClick={(e) => {
            if ((e.target as HTMLElement).closest('button,input,textarea')) return
            void insertRow(item)
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{item.name}</div>
            {item.description !== '' && <div style={{ opacity: 0.7 }}>{item.description}</div>}
          </div>
          {renaming === item.name
            ? (
              <>
                <input
                  style={input}
                  value={renameTo}
                  disabled={busy}
                  onChange={(e) => setRenameTo(e.currentTarget.value)}
                  placeholder="新名称"
                />
                <button
                  disabled={busy}
                  onClick={() => void run(async () => {
                    await renamePrompt(globalThis.fetch, item.name, renameTo.trim())
                    setRenaming(null)
                    setRenameTo('')
                  })}
                >
                  保存
                </button>
                <button disabled={busy} onClick={() => { setRenaming(null); setRenameTo('') }}>取消</button>
              </>
            )
            : (
              <>
                <button
                  disabled={busy}
                  onClick={() => { setRenaming(item.name); setRenameTo(item.name) }}
                >
                  改名
                </button>
                <button
                  disabled={busy}
                  onClick={() => void openEditor(item.name)}
                >
                  编辑
                </button>
                <button
                  disabled={busy}
                  onClick={() => void openSend(item.name)}
                >
                  发送
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`删除提示词 ${item.name}？`)) void run(() => removePrompt(globalThis.fetch, item.name))
                  }}
                >
                  删除
                </button>
              </>
            )}
          {editing === item.name && (
            <div style={{ flexBasis: '100%', padding: '8px 0 4px 12px' }}>
              <input
                style={input}
                value={editDescription}
                disabled={busy}
                onChange={(e) => setEditDescription(e.currentTarget.value)}
                placeholder="说明"
              />
              <textarea
                style={{ ...input, width: '100%', minHeight: 80, marginTop: 8, resize: 'vertical' }}
                value={editBody}
                disabled={busy}
                onChange={(e) => setEditBody(e.currentTarget.value)}
              />
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button
                  disabled={busy}
                  onClick={() => void run(async () => {
                    await updatePrompt(globalThis.fetch, item.name, { description: editDescription.trim(), body: editBody })
                    setEditing(null)
                  })}
                >
                  保存
                </button>
                <button disabled={busy} onClick={() => setEditing(null)}>取消</button>
              </div>
            </div>
          )}
          {sending === item.name && (
            <div style={{ flexBasis: '100%', padding: '8px 0 4px 12px' }}>
              {sendVars.map((variable) => (
                <div key={variable} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <code style={{ minWidth: 80 }}>{variable}</code>
                  <input
                    style={input}
                    value={sendValues[variable] ?? ''}
                    disabled={busy}
                    onChange={(e) => setSendValues({ ...sendValues, [variable]: e.currentTarget.value })}
                    placeholder={`输入 ${variable}`}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  disabled={busy}
                  onClick={() => void run(async () => {
                    await submit(item.name, sendValues)
                    setSending(null)
                  })}
                >
                  提交发送
                </button>
                <button disabled={busy} onClick={() => setSending(null)}>取消</button>
              </div>
            </div>
          )}
        </div>
      ))}
      <div style={{ ...row, borderBottom: 'none', marginTop: 8 }}>
        <input style={input} value={name} disabled={busy} onChange={(e) => setName(e.currentTarget.value)} placeholder="名称" />
        <input style={input} value={description} disabled={busy} onChange={(e) => setDescription(e.currentTarget.value)} placeholder="说明（可选）" />
      </div>
      <textarea
        style={{ ...input, width: '100%', minHeight: 64, marginTop: 8, resize: 'vertical' }}
        value={body}
        disabled={busy}
        onChange={(e) => setBody(e.currentTarget.value)}
        placeholder="正文"
      />
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button disabled={busy} onClick={() => void add()}>新增</button>
        <button disabled={busy} onClick={() => void exportFile()}>导出</button>
        <label style={{ alignSelf: 'center', opacity: busy ? 0.5 : 1 }}>
          导入
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            style={{ display: 'none' }}
            onChange={(e) => {
              const chosen = e.currentTarget.files?.[0]
              e.currentTarget.value = ''
              void importFile(chosen)
            }}
          />
        </label>
      </div>
      {error !== '' && <div style={{ marginTop: 8, color: '#f66' }}>{error}</div>}
      {notice !== '' && <div style={{ marginTop: 8 }}>{notice}</div>}
    </div>
  )
}
