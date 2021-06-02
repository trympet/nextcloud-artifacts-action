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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NextcloudArtifact = void 0;
const core_1 = __importDefault(require("@actions/core"));
const FileFinder_1 = require("../FileFinder");
const Inputs_1 = require("../Inputs");
const NextcloudClient_1 = require("./NextcloudClient");
const NoFileOption_1 = require("../NoFileOption");
class NextcloudArtifact {
    constructor(name, path, errorBehavior) {
        this.name = name;
        this.path = path;
        this.errorBehavior = errorBehavior;
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const fileFinder = new FileFinder_1.FileFinder(this.path);
            const files = yield fileFinder.findFiles();
            if (files.filesToUpload.length > 0) {
                yield this.uploadFiles(files);
            }
            else {
                this.logNoFilesFound();
            }
        });
    }
    uploadFiles(files) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logUpload(files.filesToUpload.length, files.rootDirectory);
            const client = new NextcloudClient_1.NextcloudClient(Inputs_1.Inputs.Endpoint, this.name, files.rootDirectory);
            yield client.uploadFiles(files.filesToUpload);
        });
    }
    logUpload(fileCount, rootDirectory) {
        const s = fileCount === 1 ? '' : 's';
        core_1.default.info(`With the provided path, there will be ${fileCount} file${s} uploaded`);
        core_1.default.debug(`Root artifact directory is ${rootDirectory}`);
        if (fileCount > 10000) {
            core_1.default.warning(`There are over 10,000 files in this artifact, consider create an archive before upload to improve the upload performance.`);
        }
    }
    logNoFilesFound() {
        const errorMessage = `No files were found with the provided path: ${this.path}. No artifacts will be uploaded.`;
        switch (this.errorBehavior) {
            case NoFileOption_1.NoFileOption.warn: {
                core_1.default.warning(errorMessage);
                break;
            }
            case NoFileOption_1.NoFileOption.error: {
                core_1.default.setFailed(errorMessage);
                break;
            }
            case NoFileOption_1.NoFileOption.ignore: {
                core_1.default.info(errorMessage);
                break;
            }
        }
    }
}
exports.NextcloudArtifact = NextcloudArtifact;
//# sourceMappingURL=NextcloudArtifact.js.map