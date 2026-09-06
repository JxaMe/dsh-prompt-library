import type { UsageRecord } from '../../src/usage.js'
import type { Vault } from '../../src/vault.js'

/** 内存使用统计 vault：代替持久介质，不代替被测逻辑。 */
export class MemoryUsage implements Vault<UsageRecord> {
  private readonly records = new Map<string, UsageRecord>()

  async get(name: string): Promise<UsageRecord | undefined> {
    return this.records.get(name)
  }

  async put(record: UsageRecord): Promise<void> {
    this.records.set(record.name, record)
  }

  async delete(name: string): Promise<boolean> {
    return this.records.delete(name)
  }

  async all(): Promise<readonly UsageRecord[]> {
    return [...this.records.values()]
  }
}
