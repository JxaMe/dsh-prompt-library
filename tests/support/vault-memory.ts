import type { PromptRecord, PromptVault } from '../../src/vault.js'

/** 测试与实现共用的内存 vault：代替持久介质，不代替被测逻辑。 */
export class MemoryVault implements PromptVault {
  private readonly records = new Map<string, PromptRecord>()

  async get(name: string): Promise<PromptRecord | undefined> {
    return this.records.get(name)
  }

  async put(record: PromptRecord): Promise<void> {
    this.records.set(record.name, record)
  }

  async delete(name: string): Promise<boolean> {
    return this.records.delete(name)
  }

  async all(): Promise<readonly PromptRecord[]> {
    return [...this.records.values()]
  }
}
