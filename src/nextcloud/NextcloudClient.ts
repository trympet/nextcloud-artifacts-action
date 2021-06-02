import * as fsSync from 'fs'
import * as path from 'path'
import * as core from '@actions/core';
import * as os from 'os';
import * as archiver from 'archiver';
import { URL } from 'url';
import fetch, { HeadersInit } from 'node-fetch';
import { Inputs } from '../Inputs';
import btoa from 'btoa';
import { v4 as uuidv4 } from 'uuid';
import * as webdav from 'webdav'
import { AuthType } from 'webdav';

const fs = fsSync.promises;

interface FileSpec {
    absolutePath: string,
    uploadPath: string
}

export class NextcloudClient {
    private guid: string;
    private headers: HeadersInit;
    private davClient;

    public constructor(
        private endpoint: string,
        private artifact: string,
        private rootDirectory: string) {
        this.guid = uuidv4();
        this.headers = { 'Authorization': 'Basic ' + btoa(`${Inputs.Username}:${Inputs.Password}`) };
        this.davClient = webdav.createClient(this.endpoint, {
            authType: AuthType.Digest,
            username: Inputs.Username,
            password: Inputs.Password
        });
    }

    public async uploadFiles(files: string[]) {
        const spec = this.uploadSpec(files);
        var zip = await this.zipFiles(spec);

        const path = await this.upload(zip);
        await this.shareFile(path);
    }

    private uploadSpec(files: string[]): FileSpec[] {
        const specifications = [];
        if (!fsSync.existsSync(this.rootDirectory)) {
            throw new Error(`this.rootDirectory ${this.rootDirectory} does not exist`);
        }
        if (!fsSync.lstatSync(this.rootDirectory).isDirectory()) {
            throw new Error(`this.rootDirectory ${this.rootDirectory} is not a valid directory`);
        }
        // Normalize and resolve, this allows for either absolute or relative paths to be used
        let root = path.normalize(this.rootDirectory);
        root = path.resolve(root);
        /*
           Example to demonstrate behavior
           
           Input:
             artifactName: my-artifact
             rootDirectory: '/home/user/files/plz-upload'
             artifactFiles: [
               '/home/user/files/plz-upload/file1.txt',
               '/home/user/files/plz-upload/file2.txt',
               '/home/user/files/plz-upload/dir/file3.txt'
             ]
           
           Output:
             specifications: [
               ['/home/user/files/plz-upload/file1.txt', 'my-artifact/file1.txt'],
               ['/home/user/files/plz-upload/file1.txt', 'my-artifact/file2.txt'],
               ['/home/user/files/plz-upload/file1.txt', 'my-artifact/dir/file3.txt']
             ]
        */
        for (let file of files) {
            if (!fsSync.existsSync(file)) {
                throw new Error(`File ${file} does not exist`);
            }
            if (!fsSync.lstatSync(file).isDirectory()) {
                // Normalize and resolve, this allows for either absolute or relative paths to be used
                file = path.normalize(file);
                file = path.resolve(file);
                if (!file.startsWith(root)) {
                    throw new Error(`The rootDirectory: ${root} is not a parent directory of the file: ${file}`);
                }
                // Check for forbidden characters in file paths that will be rejected during upload
                const uploadPath = file.replace(root, '');
                /*
                  uploadFilePath denotes where the file will be uploaded in the file container on the server. During a run, if multiple artifacts are uploaded, they will all
                  be saved in the same container. The artifact name is used as the root directory in the container to separate and distinguish uploaded artifacts
          
                  path.join handles all the following cases and would return 'artifact-name/file-to-upload.txt
                    join('artifact-name/', 'file-to-upload.txt')
                    join('artifact-name/', '/file-to-upload.txt')
                    join('artifact-name', 'file-to-upload.txt')
                    join('artifact-name', '/file-to-upload.txt')
                */
                specifications.push({
                    absolutePath: file,
                    uploadPath: path.join(this.artifact, uploadPath)
                });
            }
            else {
                // Directories are rejected by the server during upload
                core.debug(`Removing ${file} from rawSearchResults because it is a directory`);
            }
        }
        return specifications;
    }


    private async zipFiles(specs: FileSpec[]): Promise<string> {
        const tempArtifactDir = path.join(os.tmpdir(), this.guid);
        const artifactPath = path.join(tempArtifactDir, `artifact-${this.artifact}`);
        await fs.mkdir(path.join(artifactPath, this.artifact), { recursive: true });
        const copies = [];
        for (let spec of specs) {
            const dstpath = path.join(artifactPath, spec.uploadPath);
            const dstDir = path.dirname(dstpath);
            if (!fsSync.existsSync(dstDir)) {
                await fs.mkdir(dstDir, { recursive: true });
            }

            copies.push(fs.copyFile(spec.absolutePath, dstpath));
        }

        await Promise.all(copies);

        const archivePath = path.join(artifactPath, `${this.artifact}.zip`);
        await this.zip(path.join(artifactPath, this.artifact), archivePath);

        return archivePath;
    }

    private async zip(dirpath: string, destpath: string) {
        const archive = archiver.create('zip', { zlib: { level: 9 } });
        const stream = fsSync.createWriteStream(destpath);
        archive.directory(dirpath, false)
            .on('error', e => Promise.reject())
            .on('close', () => Promise.resolve())
            .pipe(stream);

        return archive.finalize();
    }

    private async upload(file: string) {
        const remoteFileDir = `/artifacts/${this.guid}`;
        if (!(await this.davClient.exists(remoteFileDir))) {
            await this.davClient.createDirectory(remoteFileDir, { recursive: true });
        }
        
        const remoteFilePath = path.join(remoteFileDir, `${this.artifact}.zip`);
        const stream = fsSync.createReadStream(file);
        const res = await this.davClient.putFileContents(remoteFilePath, stream, {
            onUploadProgress: p => core.debug(`Progress: ${p.loaded}/${p.total}`),
        });

        core.debug(`Upload status: ${res}`);
        return remoteFilePath;
    }

    private async shareFile(remoteFilePath: string) {
        const url = this.endpoint + `/ocs/v2.php/apps/files_sharing/api/v1/shares`;
        const body = {
            path: remoteFilePath,
            shareType: 3,
            publicUpload: "false",
            permissions: 1,
        };

        const res = await fetch(url, {
            method: 'PUT',
            headers: this.headers,
            body: JSON.stringify(body),
        });

        core.debug(await res.text())
    }
}