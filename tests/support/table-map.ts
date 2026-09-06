import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { PromptRecord } from '../../src/vault.js'

/** Map 撑起的 KvTable 桩：只替介质，不替映射逻辑。 */
export class MapTable implements KvTable<string, PromptRecord> {
  private readonly records = new Map<string, PromptRecord>()

  get(key: string): PromptRecord | undefined {
    return this.records.get(key)
  }

  entries(): IterableIterator<[string, PromptRecord]> {
    return this.records.entries()
  }

  keys(): IterableIterator<string> {
    return this.records.keys()
  }

  get size(): number {
    return this.records.size
  }

  async put(key: string, value: PromptRecord): Promise<void> {
    this.records.set(key, value)
  }

  async delete(key: string): Promise<boolean> {
    return this.records.delete(key)
  }

  async update(key: string, fn: (current: PromptRecord) => PromptRecord): Promise<PromptRecord> {
    const current = this.records.get(key)
    if (current === undefined) throw new Error(`missing-key: ${key}`)
    const next = fn(current)
    this.records.set(key, next)
    return next
  }
}
