import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { randomUUID } from 'node:crypto'
import { promises as fs, ReadStream } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { WebDAVClient } from 'webdav'

const file = fileURLToPath(new URL('./fixtures/test-artifact/a.txt', import.meta.url))
const directory = fileURLToPath(new URL('./fixtures/test-artifact/', import.meta.url))
const davClient = {
  exists: jest.fn<WebDAVClient['exists']>(),
  createDirectory: jest.fn<WebDAVClient['createDirectory']>(),
  putFileContents: jest.fn<WebDAVClient['putFileContents']>()
}
jest.unstable_mockModule('webdav', () => ({
  createClient: () => davClient
}))
const { NextcloudClient } = await import('../src/nextcloud/NextcloudClient.js')

describe('streaming uploads', () => {
  beforeEach(() => {
    davClient.exists.mockResolvedValue(true)
    davClient.createDirectory.mockResolvedValue(undefined)
    davClient.putFileContents.mockImplementation(async (_path, data) => {
      if (!(data instanceof ReadStream)) {
        throw new Error('Uploads must use a file stream')
      }
      for await (const chunk of data) {
        expect(Buffer.isBuffer(chunk)).toBe(true)
      }
      return true
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.each([1024 ** 3, 1024 ** 3 + 1, 2 * 1024 ** 3, 2 * 1024 ** 3 + 1])(
    'streams an upload reported as %i bytes without an action-imposed cap',
    async size => {
      const stats = Object.assign(await fs.stat(file), { size })
      jest.spyOn(fs, 'stat').mockResolvedValue(stats)
      const read = jest.spyOn(fs, 'readFile')
      const client = new NextcloudClient(
        new URL('https://nextcloud.example/'),
        'artifact',
        directory,
        'user',
        'password'
      )

      await expect(client['upload'](file)).resolves.toMatch(/^\/artifacts\/[0-9a-f-]{36}\/artifact\.zip$/)
      expect(read).not.toHaveBeenCalled()
      expect(davClient.putFileContents).toHaveBeenCalledWith(expect.any(String), expect.any(ReadStream), {
        headers: { 'Content-Length': String(size) }
      })
      const stream = davClient.putFileContents.mock.calls[0][1]
      expect(stream).toHaveProperty('closed', true)
      expect(stream).toHaveProperty('destroyed', true)
    }
  )

  it('closes an unconsumed stream when the remote upload fails', async () => {
    davClient.putFileContents.mockRejectedValueOnce(new Error('Upload rejected'))
    const client = new NextcloudClient(new URL('https://nextcloud.example/'), 'artifact', directory, 'user', 'password')

    await expect(client['upload'](file)).rejects.toThrow('Upload rejected')
    const stream = davClient.putFileContents.mock.calls[0][1]
    expect(stream).toHaveProperty('closed', true)
    expect(stream).toHaveProperty('destroyed', true)
  })

  it('propagates file read errors and closes the failed stream', async () => {
    const stats = await fs.stat(file)
    jest.spyOn(fs, 'stat').mockResolvedValue(stats)
    const client = new NextcloudClient(new URL('https://nextcloud.example/'), 'artifact', directory, 'user', 'password')

    await expect(client['upload'](`${file}.${randomUUID()}`)).rejects.toMatchObject({ code: 'ENOENT' })
    const stream = davClient.putFileContents.mock.calls[0][1]
    expect(stream).toHaveProperty('closed', true)
    expect(stream).toHaveProperty('destroyed', true)
  })

  it('rejects non-regular upload sources before contacting Nextcloud', async () => {
    const client = new NextcloudClient(new URL('https://nextcloud.example/'), 'artifact', directory, 'user', 'password')

    await expect(client['upload'](directory)).rejects.toThrow('Upload source must be a regular file')
    expect(davClient.exists).not.toHaveBeenCalled()
    expect(davClient.putFileContents).not.toHaveBeenCalled()
  })

  it('rejects an empty uncompressed selection explicitly', async () => {
    const client = new NextcloudClient(
      new URL('https://nextcloud.example/'),
      'artifact',
      directory,
      'user',
      'password',
      true
    )

    await expect(client.uploadFiles([])).rejects.toThrow('The no-zip input requires exactly one matching file.')
    expect(davClient.exists).not.toHaveBeenCalled()
    expect(davClient.putFileContents).not.toHaveBeenCalled()
  })
})
