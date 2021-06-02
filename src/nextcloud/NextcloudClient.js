"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.NextcloudClient = void 0;
var fsSync = require("fs");
var path = require("path");
var core = require("@actions/core");
var os = require("os");
var archiver = require("archiver");
var node_fetch_1 = require("node-fetch");
var btoa_1 = require("btoa");
var uuid_1 = require("uuid");
var webdav = require("webdav");
var fs = fsSync.promises;
var NextcloudClient = /** @class */ (function () {
    function NextcloudClient(endpoint, artifact, rootDirectory, username, password) {
        this.endpoint = endpoint;
        this.artifact = artifact;
        this.rootDirectory = rootDirectory;
        this.username = username;
        this.password = password;
        this.guid = uuid_1.v4();
        this.headers = { 'Authorization': 'Basic ' + btoa_1["default"](this.username + ":" + this.password) };
        this.davClient = webdav.createClient(this.endpoint + "/remote.php/dav/files/" + this.username, {
            username: this.username,
            password: this.password
        });
    }
    NextcloudClient.prototype.uploadFiles = function (files) {
        return __awaiter(this, void 0, void 0, function () {
            var spec, zip, path;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        core.info("Preparing upload...");
                        spec = this.uploadSpec(files);
                        core.info("Zipping files...");
                        return [4 /*yield*/, this.zipFiles(spec)];
                    case 1:
                        zip = _a.sent();
                        core.info("Uploading to Nextcloud...");
                        return [4 /*yield*/, this.upload(zip)];
                    case 2:
                        path = _a.sent();
                        core.info("File path: " + path);
                        core.info("Sharing file...");
                        return [4 /*yield*/, this.shareFile(path)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    NextcloudClient.prototype.uploadSpec = function (files) {
        var specifications = [];
        if (!fsSync.existsSync(this.rootDirectory)) {
            throw new Error("this.rootDirectory " + this.rootDirectory + " does not exist");
        }
        if (!fsSync.lstatSync(this.rootDirectory).isDirectory()) {
            throw new Error("this.rootDirectory " + this.rootDirectory + " is not a valid directory");
        }
        // Normalize and resolve, this allows for either absolute or relative paths to be used
        var root = path.normalize(this.rootDirectory);
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
        for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
            var file = files_1[_i];
            if (!fsSync.existsSync(file)) {
                throw new Error("File " + file + " does not exist");
            }
            if (!fsSync.lstatSync(file).isDirectory()) {
                // Normalize and resolve, this allows for either absolute or relative paths to be used
                file = path.normalize(file);
                file = path.resolve(file);
                if (!file.startsWith(root)) {
                    throw new Error("The rootDirectory: " + root + " is not a parent directory of the file: " + file);
                }
                // Check for forbidden characters in file paths that will be rejected during upload
                var uploadPath = file.replace(root, '');
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
                core.debug("Removing " + file + " from rawSearchResults because it is a directory");
            }
        }
        return specifications;
    };
    NextcloudClient.prototype.zipFiles = function (specs) {
        return __awaiter(this, void 0, void 0, function () {
            var tempArtifactDir, artifactPath, copies, _i, specs_1, spec, dstpath, dstDir, _a, _b, _c, archivePath, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        tempArtifactDir = path.join(os.tmpdir(), this.guid);
                        artifactPath = path.join(tempArtifactDir, "artifact-" + this.artifact);
                        return [4 /*yield*/, fs.mkdir(path.join(artifactPath, this.artifact), { recursive: true })];
                    case 1:
                        _g.sent();
                        copies = [];
                        _i = 0, specs_1 = specs;
                        _g.label = 2;
                    case 2:
                        if (!(_i < specs_1.length)) return [3 /*break*/, 6];
                        spec = specs_1[_i];
                        dstpath = path.join(artifactPath, spec.uploadPath);
                        dstDir = path.dirname(dstpath);
                        if (!!fsSync.existsSync(dstDir)) return [3 /*break*/, 4];
                        return [4 /*yield*/, fs.mkdir(dstDir, { recursive: true })];
                    case 3:
                        _g.sent();
                        _g.label = 4;
                    case 4:
                        copies.push(fs.copyFile(spec.absolutePath, dstpath));
                        _g.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 2];
                    case 6: return [4 /*yield*/, Promise.all(copies)];
                    case 7:
                        _g.sent();
                        _b = (_a = core).info;
                        _c = "files: ";
                        return [4 /*yield*/, fs.readdir(path.join(artifactPath, this.artifact))];
                    case 8:
                        _b.apply(_a, [_c + (_g.sent())]);
                        archivePath = path.join(artifactPath, this.artifact + ".zip");
                        return [4 /*yield*/, this.zip(path.join(artifactPath, this.artifact), archivePath)];
                    case 9:
                        _g.sent();
                        _e = (_d = core).info;
                        _f = "archive stat: ";
                        return [4 /*yield*/, fs.stat(archivePath)];
                    case 10:
                        _e.apply(_d, [_f + (_g.sent()).size]);
                        return [2 /*return*/, archivePath];
                }
            });
        });
    };
    NextcloudClient.prototype.zip = function (dirpath, destpath) {
        return __awaiter(this, void 0, void 0, function () {
            var archive, stream;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        archive = archiver.create('zip', { zlib: { level: 9 } });
                        stream = archive.directory(dirpath, false)
                            .pipe(fsSync.createWriteStream(destpath));
                        return [4 /*yield*/, archive.finalize()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                stream.on('error', function (e) { return reject(e); })
                                    .on('close', function () { return resolve(); });
                            })];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    NextcloudClient.prototype.upload = function (file) {
        return __awaiter(this, void 0, void 0, function () {
            var remoteFileDir, remoteFilePath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        remoteFileDir = "/artifacts/" + this.guid;
                        core.info("Checking directory...");
                        return [4 /*yield*/, this.davClient.exists(remoteFileDir)];
                    case 1:
                        if (!!(_a.sent())) return [3 /*break*/, 3];
                        core.info("Creating directory...");
                        return [4 /*yield*/, this.davClient.createDirectory(remoteFileDir, { recursive: true })];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        remoteFilePath = remoteFileDir + "/" + this.artifact + ".zip";
                        core.info("Transferring file... (" + file + ")");
                        return [4 /*yield*/, this.transferFile(remoteFilePath, file)];
                    case 4:
                        _a.sent();
                        core.info("finish");
                        return [2 /*return*/, remoteFilePath];
                }
            });
        });
    };
    NextcloudClient.prototype.transferFile = function (remoteFilePath, file) {
        var fileStream = fsSync.createReadStream(file);
        var fileStreamPromise = new Promise(function (resolve, reject) {
            fileStream.on('error', function () { return reject("Failed to read file"); })
                .on('end', function () { return resolve(); });
        });
        var remoteStream = this.davClient.createWriteStream(remoteFilePath);
        fileStream.pipe(remoteStream);
        var remoteStreamPromise = new Promise(function (resolve, reject) {
            remoteStream.on('error', function () { return reject("Failed to upload file"); })
                .on('close', function () { return resolve(); });
        });
        return Promise.all([remoteStreamPromise, fileStreamPromise]);
    };
    NextcloudClient.prototype.shareFile = function (remoteFilePath) {
        return __awaiter(this, void 0, void 0, function () {
            var url, body, res, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        url = this.endpoint + "/ocs/v2.php/apps/files_sharing/api/v1/shares";
                        body = {
                            path: remoteFilePath,
                            shareType: 3,
                            publicUpload: "false",
                            permissions: 1
                        };
                        return [4 /*yield*/, node_fetch_1["default"](url, {
                                method: 'PUT',
                                headers: this.headers,
                                body: JSON.stringify(body)
                            })];
                    case 1:
                        res = _c.sent();
                        res.status;
                        _b = (_a = core).info;
                        return [4 /*yield*/, res.text()];
                    case 2:
                        _b.apply(_a, [_c.sent()]);
                        return [2 /*return*/];
                }
            });
        });
    };
    return NextcloudClient;
}());
exports.NextcloudClient = NextcloudClient;
