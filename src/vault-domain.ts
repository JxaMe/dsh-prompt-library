import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { UsageRecord } from './usage.js'
import type { PromptRecord, Vault } from './vault.js'
import type { VersionRecord, VersionVault } from './versions.js'

/** 落盘记录 schema：与 PromptRecord 同形，边界读写都过它。 */
const promptRecordSchema = z.object({
  name: z.string(),
  description: z.string(),
  body: z.string(),
})

/** 使用统计落盘 schema：与 UsageRecord 同形。 */
const usageRecordSchema = z.object({
  name: z.string(),
  count: z.number(),
  lastUsedAt: z.number(),
})

/** 历史版本落盘 schema：与 VersionRecord 同形。 */
const versionRecordSchema = z.object({
  prompt: z.string(),
  rev: z.number(),
  description: z.string(),
  body: z.string(),
  at: z.number(),
})

/**
 * 域声明：单文件三表，版本 1。后加的表读不到按空处理，
 * 老文件直接兼容，不写迁移。坏记录整体拒绝（权威数据，不跳过）。
 */
export const PROMPT_DOMAIN = defineDomain({
  name: 'prompt_library',
  version: 1,
  tables: {
    prompts: domainTable<string, PromptRecord>(promptRecordSchema),
    usage: domainTable<string, UsageRecord>(usageRecordSchema),
    versions: domainTable<string, VersionRecord>(versionRecordSchema),
  },
})

/**
 * KvTable 套一层 Vault。只做形态转换，不做校验；
 * 读是内存同步读，写走域的写链。返回的记录是库内对象本身，不可原地改。
 */
export class DomainVault<T extends { readonly name: string }> implements Vault<T> {
  constructor(private readonly table: KvTable<string, T>) {}

  async get(name: string): Promise<T | undefined> {
    return this.table.get(name)
  }

  async put(record: T): Promise<void> {
    await this.table.put(record.name, record)
  }

  async delete(name: string): Promise<boolean> {
    return this.table.delete(name)
  }

  async all(): Promise<readonly T[]> {
    return [...this.table.entries()].map(([, record]) => record)
  }
}

/**
 * 版本表适配：复合键 `名称\n版本号`（名称禁空白，天然无冲突）。
 * 只做键形态转换，裁决归 VersionStore。
 */
export class TableVersionVault implements VersionVault {
  constructor(private readonly table: KvTable<string, VersionRecord>) {}

  private static key(prompt: string, rev: number): string {
    return `${prompt}\n${rev}`
  }

  async list(prompt: string): Promise<readonly VersionRecord[]> {
    return [...this.table.entries()]
      .map(([, record]) => record)
      .filter((record) => record.prompt === prompt)
      .sort((a, b) => b.rev - a.rev)
  }

  async put(record: VersionRecord): Promise<void> {
    await this.table.put(TableVersionVault.key(record.prompt, record.rev), record)
  }

  async delete(prompt: string, rev: number): Promise<boolean> {
    return this.table.delete(TableVersionVault.key(prompt, rev))
  }
}
