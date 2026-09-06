import type { Vault } from './vault.js'

/** 一条使用统计：用过几次、最后一次何时（epoch 毫秒）。 */
export interface UsageRecord {
  readonly name: string
  readonly count: number
  readonly lastUsedAt: number
}

/** 使用统计表的 vault 口径。 */
export type UsageVault = Vault<UsageRecord>

/**
 * 使用统计：只记成功发送。时间经注入的时钟取（测试给定，生产用 Date.now）。
 */
export class UsageStats {
  constructor(
    private readonly vault: UsageVault,
    private readonly now: () => number,
  ) {}

  /**
   * 记一次使用（次数加一，时间刷新）。记录缺席即新建。
   * @param name - 提示词名称。
   */
  async recordUse(name: string): Promise<void> {
    const current = await this.vault.get(name)
    await this.vault.put({
      name,
      count: (current?.count ?? 0) + 1,
      lastUsedAt: this.now(),
    })
  }

  /**
   * 取一条统计，没用过返回 undefined（不是故障）。
   * @param name - 提示词名称。
   * @returns 统计或 undefined。
   */
  async get(name: string): Promise<UsageRecord | undefined> {
    return this.vault.get(name)
  }
}
