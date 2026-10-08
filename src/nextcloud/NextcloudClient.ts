import * as fsSync from 'node:fs'
import * as path from 'node:path'
import * as core from '@actions/core'
import * as os from 'node:os'
import { randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { ZipArchive } from 'archiver'
import * as webdav from 'webdav'
import type { URL } from 'node:url'

const fs = fsSync.promises

interface FileSpec {
  absolutePath: string
  uploadPath: string
}

export class NextcloudClient {
  private guid: string
  private headers: Record<string, string>
  private davClient

  constructor(
    private endpoint: URL,
    private artifact: string,
    private rootDirectory: string,
    private username: string,
    private password: string,
    private noZip = false
  ) {
    this.guid = randomUUID()
    this.headers = { Authorization: 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64') }
    this.davClient = webdav.createClient(`${this.endpoint.href}remote.php/dav/files/${this.username}`, {
      username: this.username,
      password: this.password
    })
  }

  async uploadFiles(files: string[]): Promise<string> {
    core.info('Preparing upload...')
    const spec = this.uploadSpec(files)
    if (this.noZip && spec.length !== 1) {
      throw new Error('The no-zip input requires exactly one matching file.')
    }

    const tempDir = path.join(os.tmpdir(), this.guid)
    try {
      let file: string
      if (this.noZip) {
        file = spec[0].absolutePath
      } else {
        core.info('Zipping files...')
        file = await this.zipFiles(spec, tempDir)
      }

      core.info('Uploading to Nextcloud...')
      const filePath = await this.upload(file)
      core.info(`Remote file path: ${filePath}`)
      return await this.shareFile(filePath)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  }

  private uploadSpec(files: string[]): FileSpec[] {
    const specifications = []
    if (!fsSync.existsSync(this.rootDirectory)) {
      throw new Error(`this.rootDirectory ${this.rootDirectory} does not exist`)
    }
    if (!fsSync.lstatSync(this.rootDirectory).isDirectory()) {
      throw new Error(`this.rootDirectory ${this.rootDirectory} is not a valid directory`)
    }
    let root = path.normalize(this.rootDirectory)
    root = path.resolve(root)
    for (let file of files) {
      if (!fsSync.existsSync(file)) {
        throw new Error(`File ${file} does not exist`)
      }
      if (!fsSync.lstatSync(file).isDirectory()) {
        file = path.normalize(file)
        file = path.resolve(file)
        if (!file.startsWith(root)) {
          throw new Error(`The rootDirectory: ${root} is not a parent directory of the file: ${file}`)
        }

        const uploadPath = file.replace(root, '')
        specifications.push({
          absolutePath: file,
          uploadPath: path.join(this.artifact, uploadPath)
        })
      } else {
        core.debug(`Removing ${file} from rawSearchResults because it is a directory`)
      }
    }
    return specifications
  }

  private async zipFiles(specs: FileSpec[], tempArtifactDir: string): Promise<string> {
    const artifactPath = path.join(tempArtifactDir, `artifact-${this.artifact}`)
    await fs.mkdir(path.join(artifactPath, this.artifact), { recursive: true })
    const copies = []
    for (const spec of specs) {
      const dstpath = path.join(artifactPath, spec.uploadPath)
      const dstDir = path.dirname(dstpath)
      if (!fsSync.existsSync(dstDir)) {
        await fs.mkdir(dstDir, { recursive: true })
      }

      copies.push(fs.copyFile(spec.absolutePath, dstpath))
    }

    await Promise.all(copies)
    core.info(`files: ${await fs.readdir(path.join(artifactPath, this.artifact))}`)

    const archivePath = path.join(artifactPath, `${this.artifact}.zip`)
    await this.zip(path.join(artifactPath, this.artifact), archivePath)

    return archivePath
  }

  private async zip(dirpath: string, destpath: string) {
    const archive = new ZipArchive({ zlib: { level: 9 } })
    archive.on('warning', error => core.warning(error))
    archive.directory(dirpath, false)
    const completion = pipeline(archive, fsSync.createWriteStream(destpath))
    await Promise.all([completion, archive.finalize()])
  }

  private async upload(file: string): Promise<string> {
    const stats = await fs.stat(file)
    if (!stats.isFile()) {
      throw new Error(`Upload source must be a regular file: ${file}`)
    }

    const remoteFileDir = `/artifacts/${this.guid}`
    if (!(await this.davClient.exists(remoteFileDir))) {
      await this.davClient.createDirectory(remoteFileDir, { recursive: true })
    }

    const remoteFilePath = `${remoteFileDir}/${this.artifact}${this.noZip ? '' : '.zip'}`
    core.debug(`Transferring file... (${file})`)

    const stream = fsSync.createReadStream(file)
    try {
      await this.davClient.putFileContents(remoteFilePath, stream, {
        headers: { 'Content-Length': String(stats.size) }
      })
    } finally {
      await stream[Symbol.asyncDispose]()
    }

    return remoteFilePath
  }

  private async shareFile(remoteFilePath: string): Promise<string> {
    const url = `${this.endpoint.href}ocs/v2.php/apps/files_sharing/api/v1/shares`
    const body = {
      path: remoteFilePath,
      shareType: 3,
      publicUpload: 'false',
      permissions: 1
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.headers,
        'OCS-APIRequest': 'true',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    const result = await res.text()
    if (!res.ok) {
      throw new Error(`Failed to create Nextcloud share: ${res.status} ${res.statusText}`)
    }
    core.debug(`Share response: ${result}`)
    const re = /<url>(?<share_url>.*)<\/url>/
    const match = re.exec(result)
    core.debug(`Match groups:\n${JSON.stringify(match?.groups)}`)
    const sharableUrl = (match?.groups || {})['share_url']
    if (!sharableUrl) {
      throw new Error(`Failed to parse or find sharable URL:\n${result}`)
    }

    return sharableUrl
  }
}
