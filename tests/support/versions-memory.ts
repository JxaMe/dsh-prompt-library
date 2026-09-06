import type { VersionRecord, VersionVault } from '../../src/versions.js'

/** 内存版本 vault：代替持久介质，不代替被测逻辑。 */
export class MemoryVersions implements VersionVault {
  private readonly records = new Map<string, VersionRecord>()

  private key(prompt: string, rev: number): string {
    return `${prompt}\n${rev}`
  }

  async list(prompt: string): Promise<readonly VersionRecord[]> {
    return [...this.records.values()]
      .filter((row) => row.prompt === prompt)
      .sort((a, b) => b.rev - a.rev)
  }

  async put(record: VersionRecord): Promise<void> {
    this.records.set(this.key(record.prompt, record.rev), record)
  }

  async delete(prompt: string, rev: number): Promise<boolean> {
    return this.records.delete(this.key(prompt, rev))
  }
}
