import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import { unzipSync } from 'fflate'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { IncomingHttpHeaders, Server } from 'node:http'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = fileURLToPath(new URL('../', import.meta.url))
const fixtures = path.join(repository, '__tests__', 'fixtures', 'test-artifact')

interface Request {
  method: string | undefined
  url: string | undefined
  headers: IncomingHttpHeaders
  body: Buffer
}

interface ActionResult {
  code: number | null
  stdout: string
  stderr: string
  output: string
}

function outputs(result: ActionResult): Record<string, string> {
  if (!result.output) return {}
  const lines = result.output.trimEnd().split(/\r?\n/)
  expect(lines.length % 3).toBe(0)
  const values: Record<string, string> = {}
  for (let index = 0; index < lines.length; index += 3) {
    const [name, delimiter] = lines[index].split('<<')
    expect(delimiter).toBeTruthy()
    expect(lines[index + 2]).toBe(delimiter)
    values[name] = lines[index + 1]
  }
  return values
}

describe('compiled action on Node.js 24', () => {
  let directory: string
  let server: Server
  let endpoint: string
  let requests: Request[]
  let shareStatus: number
  let checkStatus: number
  let uploadStatus: number
  let shareResponse: string | undefined
  let eventName: string

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'nextcloud-artifacts-test-'))
    const actionDirectory = path.join(directory, 'action')
    await mkdir(actionDirectory)
    await cp(path.join(repository, 'dist'), path.join(actionDirectory, 'dist'), { recursive: true })
    await cp(path.join(repository, 'package.json'), path.join(actionDirectory, 'package.json'))
    await writeFile(path.join(directory, 'output'), '')
    await writeFile(path.join(directory, 'event.json'), '{}')
    requests = []
    shareStatus = 200
    checkStatus = 201
    uploadStatus = 201
    shareResponse = undefined
    eventName = 'push'

    server = createServer(async (request, response) => {
      try {
        const chunks: Buffer[] = []
        for await (const chunk of request) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }
        requests.push({
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: Buffer.concat(chunks)
        })

        if (request.method === 'POST' && request.url === '/repos/owner/repo/check-runs') {
          response.writeHead(checkStatus, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify(checkStatus === 201 ? { id: 42 } : { message: 'Forbidden' }))
        } else if (request.method === 'PATCH' && request.url === '/repos/owner/repo/check-runs/42') {
          response.writeHead(200, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify({ url: `${endpoint}/checks/42`, html_url: `${endpoint}/checks/42` }))
        } else if (request.method === 'PROPFIND') {
          response.writeHead(404).end()
        } else if (request.method === 'MKCOL') {
          response.writeHead(201).end()
        } else if (request.method === 'PUT') {
          response.writeHead(uploadStatus).end()
        } else if (request.method === 'POST' && request.url === '/ocs/v2.php/apps/files_sharing/api/v1/shares') {
          response.writeHead(shareStatus, { 'Content-Type': 'application/xml' })
          response.end(shareResponse ?? `<ocs><data><url>${endpoint}/s/artifact</url></data></ocs>`)
        } else {
          response.writeHead(404).end(`Unexpected request: ${request.method} ${request.url}`)
        }
      } catch (error) {
        response.writeHead(500).end(String(error))
      }
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('The test server did not bind to a TCP port')
    }
    endpoint = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()))
    })
    await rm(directory, { recursive: true, force: true })
  })

  async function runAction(inputs: Record<string, string> = {}): Promise<ActionResult> {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GITHUB_API_URL: endpoint,
      GITHUB_REPOSITORY: 'owner/repo',
      GITHUB_SHA: 'a'.repeat(40),
      GITHUB_RUN_ID: '123',
      GITHUB_EVENT_NAME: eventName,
      GITHUB_EVENT_PATH: path.join(directory, 'event.json'),
      GITHUB_OUTPUT: path.join(directory, 'output'),
      GITHUB_WORKSPACE: directory,
      NO_PROXY: '127.0.0.1,localhost',
      no_proxy: '127.0.0.1,localhost',
      TEMP: directory,
      TMP: directory,
      TMPDIR: directory
    }
    const values = {
      name: 'test-artifact',
      path: fixtures,
      'nextcloud-url': `${endpoint}/`,
      'nextcloud-username': 'test-user',
      'nextcloud-password': 'test-password',
      'if-no-files-found': 'warn',
      token: 'test-token',
      ...inputs
    }
    for (const [name, value] of Object.entries(values)) {
      env[`INPUT_${name.toUpperCase()}`] = value
    }

    const result = await new Promise<Omit<ActionResult, 'output'>>((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(directory, 'action', 'dist', 'index.js')], {
        cwd: directory,
        env,
        timeout: 15000
      })
      let stdout = ''
      let stderr = ''
      child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
        stdout += chunk
      })
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
        stderr += chunk
      })
      child.once('error', reject)
      child.once('close', code => resolve({ code, stdout, stderr }))
    })
    return { ...result, output: await readFile(path.join(directory, 'output'), 'utf8') }
  }

  it('uploads a ZIP, creates a public share and completes the GitHub check without node_modules', async () => {
    const result = await runAction()
    expect(result).toMatchObject({ code: 0, stderr: '' })
    const upload = requests.find(request => request.method === 'PUT')
    const share = requests.find(request => request.url === '/ocs/v2.php/apps/files_sharing/api/v1/shares')
    if (!upload || !share) {
      throw new Error('Expected both a WebDAV upload and a share request')
    }
    expect(upload.url).toMatch(/^\/remote\.php\/dav\/files\/test-user\/artifacts\/[0-9a-f-]{36}\/test-artifact\.zip$/)
    expect(upload.headers.authorization).toBe(`Basic ${Buffer.from('test-user:test-password').toString('base64')}`)
    expect(upload.headers['content-length']).toBe(String(upload.body.length))
    expect(upload.headers['transfer-encoding']).toBeUndefined()
    const archive = unzipSync(upload.body)
    expect(
      Object.keys(archive)
        .filter(name => !name.endsWith('/'))
        .sort()
    ).toEqual(['a.txt', 'some-folder/b.txt'])
    expect(Buffer.from(archive['a.txt'])).toEqual(await readFile(path.join(fixtures, 'a.txt')))
    expect(Buffer.from(archive['some-folder/b.txt'])).toEqual(
      await readFile(path.join(fixtures, 'some-folder', 'b.txt'))
    )
    expect(share.headers['ocs-apirequest']).toBe('true')
    expect(JSON.parse(share.body.toString())).toEqual({
      path: upload.url?.replace('/remote.php/dav/files/test-user', ''),
      shareType: 3,
      publicUpload: 'false',
      permissions: 1
    })
    expect(outputs(result)).toEqual({
      SHAREABLE_URL: `${endpoint}/s/artifact`,
      DIRECT_SHAREABLE_URL: `${endpoint}/s/artifact/download`
    })
    expect(
      requests.filter(request => request.method === 'PATCH').map(request => JSON.parse(request.body.toString()))
    ).toEqual([expect.objectContaining({ conclusion: 'success', status: 'completed' })])
  })

  it.each(['false', 'False', 'FALSE'])('keeps ZIP uploads enabled for no-zip: %s', async noZip => {
    const result = await runAction({ 'no-zip': noZip })
    expect(result).toMatchObject({ code: 0, stderr: '' })
    const upload = requests.find(request => request.method === 'PUT')
    if (!upload) {
      throw new Error('Expected a WebDAV upload')
    }
    expect(upload.url).toMatch(/\/test-artifact\.zip$/)
    expect(Object.keys(unzipSync(upload.body))).toContain('some-folder/b.txt')
  })

  it.each(['true', 'True', 'TRUE'])('uploads a single file unchanged for no-zip: %s', async noZip => {
    const source = path.join(directory, 'source file.bin')
    const content = Buffer.from([0, 255, 1, 128, 10, 13, 0])
    await writeFile(source, content)

    const result = await runAction({
      name: 'my-installer.bin',
      path: source,
      'no-zip': noZip
    })
    expect(result).toMatchObject({ code: 0, stderr: '' })
    const upload = requests.find(request => request.method === 'PUT')
    if (!upload) {
      throw new Error('Expected a WebDAV upload')
    }
    expect(upload.url).toMatch(/^\/remote\.php\/dav\/files\/test-user\/artifacts\/[0-9a-f-]{36}\/my-installer\.bin$/)
    expect(upload.body).toEqual(content)
    expect(upload.headers['content-length']).toBe(String(content.length))
    expect(upload.headers['transfer-encoding']).toBeUndefined()
    expect(result.stdout).not.toContain('Zipping files...')
    expect(await readFile(source)).toEqual(content)
    expect(outputs(result)).toEqual({
      SHAREABLE_URL: `${endpoint}/s/artifact`,
      DIRECT_SHAREABLE_URL: `${endpoint}/s/artifact/download`
    })
  })

  it('streams an empty uncompressed file with a zero content length', async () => {
    const source = path.join(directory, 'empty.txt')
    await writeFile(source, '')

    const result = await runAction({ path: source, 'no-zip': 'true' })
    expect(result).toMatchObject({ code: 0, stderr: '' })
    const upload = requests.find(request => request.method === 'PUT')
    expect(upload?.headers['content-length']).toBe('0')
    expect(upload?.body.length).toBe(0)
    expect(await readFile(source, 'utf8')).toBe('')
  })

  it.each(['directory', 'glob'])('accepts a %s selecting one uncompressed file', async selection => {
    const sourceDirectory = path.join(directory, 'selection')
    await mkdir(sourceDirectory)
    const source = path.join(sourceDirectory, 'single.bin')
    const content = Buffer.from('Only one matching file')
    await writeFile(source, content)

    const result = await runAction({
      path: selection === 'directory' ? sourceDirectory : path.join(sourceDirectory, '*.bin'),
      'no-zip': 'true'
    })
    expect(result).toMatchObject({ code: 0, stderr: '' })
    const uploads = requests.filter(request => request.method === 'PUT')
    expect(uploads).toHaveLength(1)
    expect(uploads[0].body).toEqual(content)
    expect(await readFile(source)).toEqual(content)
  })

  it('rejects multiple matching files in uncompressed mode without uploading', async () => {
    const result = await runAction({ 'no-zip': 'true' })
    expect(result).toMatchObject({ code: 1, stderr: '', output: '' })
    expect(result.stdout).toContain('The no-zip input requires exactly one matching file.')
    expect(requests.some(request => request.method === 'PUT')).toBe(false)
    expect(
      requests.filter(request => request.method === 'PATCH').map(request => JSON.parse(request.body.toString()))
    ).toEqual([expect.objectContaining({ conclusion: 'failure', status: 'completed' })])
  })

  it.each(['yes', '1', 'invalid'])('rejects invalid no-zip input %s before creating a check', async noZip => {
    const result = await runAction({ 'no-zip': noZip })
    expect(result).toMatchObject({ code: 1, stderr: '', output: '' })
    expect(result.stdout).toContain('no-zip')
    expect(requests).toEqual([])
  })

  it.each(['upload', 'share'])('preserves the original uncompressed file on %s failure', async stage => {
    const source = path.join(directory, 'source.bin')
    const content = Buffer.from('Original local artifact')
    await writeFile(source, content)
    if (stage === 'upload') uploadStatus = 507
    else shareStatus = 503

    const result = await runAction({ path: source, 'no-zip': 'true' })
    expect(result).toMatchObject({ code: 1, stderr: '', output: '' })
    expect(await readFile(source)).toEqual(content)
    expect(
      requests.filter(request => request.method === 'PATCH').map(request => JSON.parse(request.body.toString()))
    ).toEqual([expect.objectContaining({ conclusion: 'failure', status: 'completed' })])
  })

  it.each([
    {
      share: 'https://cloud.example/nextcloud/index.php/s/token',
      download: 'https://cloud.example/nextcloud/index.php/s/token/download'
    },
    {
      share: 'https://cloud.example/s/token/',
      download: 'https://cloud.example/s/token/download'
    },
    {
      share: 'https://cloud.example/s/token?key=value#section',
      download: 'https://cloud.example/s/token/download?key=value#section'
    }
  ])('constructs a direct-download URL from $share', async ({ share, download }) => {
    shareResponse = `<ocs><data><url>${share}</url></data></ocs>`
    const result = await runAction()
    expect(result).toMatchObject({ code: 0, stderr: '' })
    expect(outputs(result)).toEqual({ SHAREABLE_URL: share, DIRECT_SHAREABLE_URL: download })
  })

  it('does not publish partial outputs for a malformed share URL', async () => {
    shareResponse = '<ocs><data><url>not-a-url</url></data></ocs>'
    const result = await runAction()
    expect(result).toMatchObject({ code: 1, stderr: '', output: '' })
    expect(
      requests.filter(request => request.method === 'PATCH').map(request => JSON.parse(request.body.toString()))
    ).toEqual([expect.objectContaining({ conclusion: 'failure', status: 'completed' })])
  })

  it.each([
    { name: 'single file', pattern: path.join(fixtures, 'a.txt'), files: ['a.txt'] },
    { name: 'wildcard', pattern: path.join(fixtures, '**', '*.txt'), files: ['a.txt', 'some-folder/b.txt'] },
    {
      name: 'multiple search paths',
      pattern: `${path.join(fixtures, 'a.txt')}\n${path.join(fixtures, 'some-folder', 'b.txt')}`,
      files: ['a.txt', 'some-folder/b.txt']
    },
    {
      name: 'excluded file',
      pattern: `${fixtures}\n!${path.join(fixtures, 'some-folder', 'b.txt')}`,
      files: ['a.txt']
    }
  ])('preserves the ZIP layout for $name inputs', async ({ pattern, files }) => {
    const result = await runAction({ path: pattern })
    expect(result).toMatchObject({ code: 0, stderr: '' })
    const upload = requests.find(request => request.method === 'PUT')
    if (!upload) {
      throw new Error('Expected a WebDAV upload')
    }
    expect(
      Object.keys(unzipSync(upload.body))
        .filter(name => !name.endsWith('/'))
        .sort()
    ).toEqual(files)
  })

  it.each([
    { event: 'push', payload: {}, sha: 'a'.repeat(40) },
    { event: 'pull_request', payload: { pull_request: { head: { sha: 'b'.repeat(40) } } }, sha: 'b'.repeat(40) },
    {
      event: 'workflow_run',
      payload: { workflow_run: { head_commit: { id: 'c'.repeat(40) }, id: 456 } },
      sha: 'c'.repeat(40)
    }
  ])('uses the correct check-run commit for $event events', async ({ event, payload, sha }) => {
    eventName = event
    await writeFile(path.join(directory, 'event.json'), JSON.stringify(payload))
    const result = await runAction()
    expect(result).toMatchObject({ code: 0, stderr: '' })
    const check = requests.find(request => request.url === '/repos/owner/repo/check-runs')
    if (!check) {
      throw new Error('Expected a GitHub check run')
    }
    expect(JSON.parse(check.body.toString()).head_sha).toBe(sha)
  })

  it.each(
    [
      { behavior: 'warn', code: 0, message: '::warning::' },
      { behavior: 'error', code: 1, message: '::error::' },
      { behavior: 'ignore', code: 0, message: 'No files were found' }
    ].flatMap(testCase => ['false', 'true'].map(noZip => ({ ...testCase, noZip })))
  )('preserves $behavior for unmatched paths with no-zip: $noZip', async ({ behavior, code, message, noZip }) => {
    const result = await runAction({
      path: path.join(directory, 'missing', '*.txt'),
      'if-no-files-found': behavior,
      'no-zip': noZip
    })
    expect(result).toMatchObject({ code, stderr: '', output: '' })
    expect(result.stdout).toContain(message)
    if (behavior === 'ignore') {
      expect(result.stdout).not.toContain('::warning::')
      expect(result.stdout).not.toContain('::error::')
    }
    expect(requests).toEqual([])
  })

  it('rejects an invalid no-files behavior before making requests', async () => {
    const result = await runAction({ 'if-no-files-found': 'invalid' })
    expect(result).toMatchObject({ code: 1, stderr: '', output: '' })
    expect(result.stdout).toContain('Unrecognized if-no-files-found input')
    expect(requests).toEqual([])
  })

  it('fails when a required path is missing', async () => {
    const result = await runAction({ path: '' })
    expect(result).toMatchObject({ code: 1, stderr: '', output: '' })
    expect(result.stdout).toContain('Input required and not supplied: path')
    expect(requests).toEqual([])
  })

  it('marks the GitHub check as failed when Nextcloud rejects the share request', async () => {
    shareStatus = 503
    const result = await runAction()
    expect(result).toMatchObject({ code: 1, stderr: '', output: '' })
    expect(result.stdout).toContain('Failed to create Nextcloud share: 503')
    expect(
      requests.filter(request => request.method === 'PATCH').map(request => JSON.parse(request.body.toString()))
    ).toEqual([expect.objectContaining({ conclusion: 'failure', status: 'completed' })])
  })

  it('fails when the share response does not contain a public URL', async () => {
    shareResponse = '<ocs><meta><status>failure</status></meta></ocs>'
    const result = await runAction()
    expect(result).toMatchObject({ code: 1, stderr: '', output: '' })
    expect(result.stdout).toContain('Failed to parse or find sharable URL')
    expect(
      requests.filter(request => request.method === 'PATCH').map(request => JSON.parse(request.body.toString()))
    ).toEqual([expect.objectContaining({ conclusion: 'failure', status: 'completed' })])
  })

  it('fails the check without creating a share when the upload is rejected', async () => {
    uploadStatus = 507
    const result = await runAction()
    expect(result).toMatchObject({ code: 1, stderr: '', output: '' })
    expect(result.stdout).toContain('507')
    expect(requests.some(request => request.url === '/ocs/v2.php/apps/files_sharing/api/v1/shares')).toBe(false)
    expect(
      requests.filter(request => request.method === 'PATCH').map(request => JSON.parse(request.body.toString()))
    ).toEqual([expect.objectContaining({ conclusion: 'failure', status: 'completed' })])
  })

  it('does not upload when the GitHub token cannot create checks', async () => {
    checkStatus = 403
    const result = await runAction()
    expect(result).toMatchObject({ code: 1, output: '' })
    expect(result.stdout).toContain('Forbidden')
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe('/repos/owner/repo/check-runs')
  })
})
