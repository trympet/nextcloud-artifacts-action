import * as fsSync from 'fs'
import * as path from 'path'
import * as core from '@actions/core'
import * as os from 'os'
import * as archiver from 'archiver'
import fetch, { HeadersInit } from 'node-fetch'
import btoa from 'btoa'
import { v4 as uuidv4 } from 'uuid'
import * as webdav from 'webdav'
import { URL } from 'url'

const fs = fsSync.promises

interface FileSpec {
  absolutePath: string
  uploadPath: string
}

export class NextcloudClient {
  private guid: string
  private headers: HeadersInit
  private davClient

  constructor(
    private endpoint: URL,
    private artifact: string,
    private rootDirectory: string,
    private username: string,
    private password: string
  ) {
    this.guid = uuidv4()
    this.headers = { Authorization: 'Basic ' + btoa(`${this.username}:${this.password}`) }
    this.davClient = webdav.createClient(`${this.endpoint.href}remote.php/dav/files/${this.username}`, {
      username: this.username,
      password: this.password
    })
  }

  async uploadFiles(files: string[]): Promise<string> {
    core.info('Preparing upload...')
    const spec = this.uploadSpec(files)
    core.info('Zipping files...')
    const zip = await this.zipFiles(spec)

    core.info('Uploading to Nextcloud...')
    const filePath = await this.upload(zip)
    core.info(`Remote file path: ${filePath}`)
    return await this.shareFile(filePath)
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

  private async zipFiles(specs: FileSpec[]): Promise<string> {
    const tempArtifactDir = path.join(os.tmpdir(), this.guid)
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
    const archive = archiver.create('zip', { zlib: { level: 9 } })
    const stream = archive.directory(dirpath, false).pipe(fsSync.createWriteStream(destpath))

    await archive.finalize()

    return await new Promise<void>((resolve, reject) => {
      stream.on('error', e => reject(e)).on('close', () => resolve())
    })
  }

  private async upload(file: string): Promise<string> {
    const remoteFileDir = `/artifacts/${this.guid}`
    if (!(await this.davClient.exists(remoteFileDir))) {
      await this.davClient.createDirectory(remoteFileDir, { recursive: true })
    }

    const remoteFilePath = `${remoteFileDir}/${this.artifact}.zip`
    core.debug(`Transferring file... (${file})`)

    const fileStat = await fs.stat(file)
    const fileStream = fsSync.createReadStream(file)
    const fileStreamPromise = new Promise<void>((resolve, reject) => {
      fileStream.on('error', e => reject(e)).on('close', () => resolve())
    })
    const remoteStream = this.davClient.createWriteStream(remoteFilePath, {
      headers: { 'Content-Length': fileStat.size.toString() }
    })
    const remoteStreamPromise = new Promise<void>((resolve, reject) => {
      remoteStream.on('error', e => reject(e)).on('finish', () => resolve())
    })

    fileStream.pipe(remoteStream)

    const timer = setTimeout(() => {}, 20_000)
    await Promise.all([fileStreamPromise, remoteStreamPromise])

    // HACK: Nextcloud has not fully processed the file, despite returning 200.
    // Waiting for 1s seems to do the trick.
    await new Promise(resolve => setTimeout(resolve, 1_000))

    clearTimeout(timer)
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
      headers: Object.assign(this.headers, {
        'OCS-APIRequest': true,
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify(body)
    })

    const result = await res.text()
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
