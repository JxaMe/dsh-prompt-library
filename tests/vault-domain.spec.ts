import { describe, expect, test } from 'vitest'
import { DomainVault } from '../src/vault-domain.js'
import { MapTable } from './support/table-map.js'

describe('DomainVault', () => {
  test('存取删与全量直通到底层表', async () => {
    const vault = new DomainVault(new MapTable())
    await vault.put({ name: 'deploy', description: '说明', body: '正文' })
    expect(await vault.get('deploy')).toEqual({ name: 'deploy', description: '说明', body: '正文' })
    expect(await vault.all()).toEqual([{ name: 'deploy', description: '说明', body: '正文' }])
    expect(await vault.delete('deploy')).toBe(true)
    expect(await vault.delete('deploy')).toBe(false)
    expect(await vault.get('deploy')).toBeUndefined()
  })
})
