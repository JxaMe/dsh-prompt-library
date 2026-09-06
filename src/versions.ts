/** 一条历史版本：某提示词在某次的完整内容快照。 */
export interface VersionRecord {
  readonly prompt: string
  readonly rev: number
  readonly description: string
  readonly body: string
  readonly at: number
}

/** 版本 vault 口：按提示词列快照、存、删。 */
export interface VersionVault {
  list(prompt: string): Promise<readonly VersionRecord[]>
  put(record: VersionRecord): Promise<void>
  delete(prompt: string, rev: number): Promise<boolean>
}

/**
 * 版本历史：每次改内容存一版，只留最近 cap 版。时间经注入时钟取。
 */
export class VersionStore {
  constructor(
    private readonly vault: VersionVault,
    private readonly now: () => number,
    private readonly cap = 20,
  ) {}

  /**
   * 存一版（rev 单调递增）。超 cap 剪最旧的。
   * @param prompt - 提示词名称。
   * @param content - 说明与正文快照。
   */
  async save(prompt: string, content: { description: string; body: string }): Promise<void> {
    const existing = await this.vault.list(prompt)
    const rev = existing.reduce((max, row) => Math.max(max, row.rev), 0) + 1
    await this.vault.put({ prompt, rev, description: content.description, body: content.body, at: this.now() })
    const overflow = [...existing].sort((a, b) => a.rev - b.rev).slice(0, Math.max(0, existing.length + 1 - this.cap))
    for (const row of overflow) await this.vault.delete(prompt, row.rev)
  }

  /**
   * 读历史，rev 倒序。
   * @param prompt - 提示词名称。
   * @returns 快照数组。
   */
  async history(prompt: string): Promise<readonly VersionRecord[]> {
    return this.vault.list(prompt)
  }

  /**
   * 改名搬运版本（rev 保持，换 prompt 归属）。
   * @param from - 旧名称。
   * @param to - 新名称。
   */
  async move(from: string, to: string): Promise<void> {
    const existing = await this.vault.list(from)
    for (const row of existing) {
      await this.vault.put({ ...row, prompt: to })
      await this.vault.delete(from, row.rev)
    }
  }
}
