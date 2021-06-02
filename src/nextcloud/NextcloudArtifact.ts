import * as core from '@actions/core';
import { FileFinder } from '../FileFinder';
import { Inputs } from '../Inputs';
import { NextcloudClient } from './NextcloudClient';
import { NoFileOption } from '../NoFileOption';

export class NextcloudArtifact {
    public constructor(
        private name: string,
        private path: string,
        private errorBehavior: NoFileOption) { }

    public async run() {
        const fileFinder = new FileFinder(this.path);
        const files = await fileFinder.findFiles();

        if (files.filesToUpload.length > 0) {
            await this.uploadFiles(files);
        }
        else {
            this.logNoFilesFound();
        }
    }

    private async uploadFiles(files: { filesToUpload: string[]; rootDirectory: string; }) {
        this.logUpload(files.filesToUpload.length, files.rootDirectory);

        const client = new NextcloudClient(Inputs.Endpoint, this.name, files.rootDirectory, Inputs.Username, Inputs.Password);

        await client.uploadFiles(files.filesToUpload);
    }

    private logUpload(fileCount: number, rootDirectory: string) {
        const s = fileCount === 1 ? '' : 's';
        core.info(
            `With the provided path, there will be ${fileCount} file${s} uploaded`
        );
        core.debug(`Root artifact directory is ${rootDirectory}`);

        if (fileCount > 10000) {
            core.warning(
                `There are over 10,000 files in this artifact, consider create an archive before upload to improve the upload performance.`
            );
        }
    }

    private logNoFilesFound() {
        const errorMessage = `No files were found with the provided path: ${this.path}. No artifacts will be uploaded.`;
        switch (this.errorBehavior) {
            case NoFileOption.warn: {
                core.warning(errorMessage);
                break;
            }
            case NoFileOption.error: {
                core.setFailed(errorMessage);
                break;
            }
            case NoFileOption.ignore: {
                core.info(errorMessage);
                break;
            }
        }
    }
}
