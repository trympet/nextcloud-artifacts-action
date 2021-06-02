"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NextcloudClient = void 0;
const fsSync = __importStar(require("fs"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const core_1 = __importDefault(require("@actions/core"));
const os = __importStar(require("os"));
const crypto_1 = require("crypto");
const archiver = __importStar(require("archiver"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const Inputs_1 = require("../Inputs");
const btoa_1 = __importDefault(require("btoa"));
class NextcloudClient {
    constructor(endpoint, artifact, rootDirectory) {
        this.endpoint = endpoint;
        this.artifact = artifact;
        this.rootDirectory = rootDirectory;
        this.guid = crypto_1.randomUUID();
        this.headers = { 'Authorization': 'Basic ' + btoa_1.default(`${Inputs_1.Inputs.Username}:${Inputs_1.Inputs.Password}`) };
    }
    uploadFiles(files) {
        return __awaiter(this, void 0, void 0, function* () {
            const spec = this.uploadSpec(files);
            var zip = yield this.zipFiles(spec);
            const path = yield this.upload(zip);
            yield this.shareFile(path);
        });
    }
    uploadSpec(files) {
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
                core_1.default.debug(`Removing ${file} from rawSearchResults because it is a directory`);
            }
        }
        return specifications;
    }
    zipFiles(specs) {
        return __awaiter(this, void 0, void 0, function* () {
            const tempArtifactDir = path.join(os.tmpdir(), this.guid);
            const artifactPath = path.join(tempArtifactDir, `artifact-${this.artifact}`);
            yield fs.mkdir(artifactPath, { recursive: true });
            for (let spec of specs) {
                yield fs.copyFile(spec.absolutePath, path.join(artifactPath, spec.uploadPath));
            }
            const archivePath = path.join(artifactPath, `${this.artifact}.zip`);
            yield this.zip(path.join(artifactPath, this.artifact), archivePath);
            return archivePath;
        });
    }
    zip(dirpath, destpath) {
        return __awaiter(this, void 0, void 0, function* () {
            const archive = archiver.create('zip', { zlib: { level: 9 } });
            const stream = fsSync.createWriteStream(destpath);
            archive.directory(dirpath, false)
                .on('error', e => Promise.reject())
                .on('close', () => Promise.resolve())
                .pipe(stream);
            return archive.finalize();
        });
    }
    upload(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const filePath = `/artifacts/${this.guid}/${this.artifact}`;
            const url = this.endpoint + `/remote.php/dav/files/${Inputs_1.Inputs.Username}` + filePath;
            const stream = fsSync.createReadStream(file);
            const res = yield node_fetch_1.default(url, {
                method: 'PUT',
                body: stream,
                headers: this.headers
            });
            core_1.default.debug(yield res.json());
            return filePath;
        });
    }
    shareFile(nextcloudPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = this.endpoint + `/ocs/v2.php/apps/files_sharing/api/v1/shares`;
            const body = {
                path: nextcloudPath,
                shareType: 3,
                publicUpload: "false",
                permissions: 1,
            };
            const res = yield node_fetch_1.default(url, {
                method: 'PUT',
                headers: this.headers,
                body: JSON.stringify(body),
            });
            core_1.default.debug(yield res.json());
        });
    }
}
exports.NextcloudClient = NextcloudClient;
//# sourceMappingURL=NextcloudClient.js.map