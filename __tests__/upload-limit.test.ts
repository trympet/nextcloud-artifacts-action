import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'

const file = fileURLToPath(new URL('./fixtures/test-artifact/a.txt', import.meta.url))
const directory = fileURLToPath(new URL('./fixtures/test-artifact/', import.meta.url))
const davClient = {
  exists: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  createDirectory: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  putFileContents: jest.fn<() => Promise<boolean>>().mockResolvedValue(true)
}
jest.unstable_mockModule('webdav', () => ({
  createClient: () => davClient
}))
const { NextcloudClient } = await import('../src/nextcloud/NextcloudClient.js')

describe('archive upload size limit', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.each([1024 ** 3 - 1, 1024 ** 3])('accepts an archive reported as %i bytes', async size => {
    const stats = Object.assign(await fs.stat(file), { size })
    jest.spyOn(fs, 'stat').mockResolvedValue(stats)
    const client = new NextcloudClient(new URL('https://nextcloud.example/'), 'artifact', directory, 'user', 'password')

    await expect(client['upload'](file)).resolves.toMatch(/^\/artifacts\/[0-9a-f-]{36}\/artifact\.zip$/)
    expect(davClient.putFileContents).toHaveBeenCalledTimes(1)
  })

  it('rejects an archive one byte over 1 GiB before reading or uploading it', async () => {
    const stats = Object.assign(await fs.stat(file), { size: 1024 ** 3 + 1 })
    jest.spyOn(fs, 'stat').mockResolvedValue(stats)
    const read = jest.spyOn(fs, 'readFile')
    const client = new NextcloudClient(new URL('https://nextcloud.example/'), 'artifact', directory, 'user', 'password')

    await expect(client['upload'](file)).rejects.toThrow('Artifact exceeds the 1 GiB upload limit')
    expect(read).not.toHaveBeenCalled()
    expect(davClient.exists).not.toHaveBeenCalled()
    expect(davClient.putFileContents).not.toHaveBeenCalled()
  })
})
