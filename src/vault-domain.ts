import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { PromptRecord, PromptVault } from './vault.js'

/** 落盘记录 schema：与 PromptRecord 同形，边界读写都过它。 */
const promptRecordSchema = z.object({
  name: z.string(),
  description: z.string(),
  body: z.string(),
})

/** 域声明：单文件单表，版本 1。坏记录整体拒绝（权威数据，不跳过）。 */
export const PROMPT_DOMAIN = defineDomain({
  name: 'prompt_library',
  version: 1,
  tables: {
    prompts: domainTable<string, PromptRecord>(promptRecordSchema),
  },
})

/**
 * KvTable 套一层 PromptVault。只做形态转换，不做校验；
 * 读是内存同步读，写走域的写链。返回的记录是库内对象本身，不可原地改。
 */
export class DomainVault implements PromptVault {
  constructor(private readonly table: KvTable<string, PromptRecord>) {}

  async get(name: string): Promise<PromptRecord | undefined> {
    return this.table.get(name)
  }

  async put(record: PromptRecord): Promise<void> {
    await this.table.put(record.name, record)
  }

  async delete(name: string): Promise<boolean> {
    return this.table.delete(name)
  }

  async all(): Promise<readonly PromptRecord[]> {
    return [...this.table.entries()].map(([, record]) => record)
  }
}
