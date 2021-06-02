import core from '@actions/core';
import { NoFileOption } from './NoFileOption';

export class Inputs {
    static get ArtifactName(): string {
        return core.getInput("name");
    }

    static get ArtifactPath(): string {
        return core.getInput("path");
    }

    static get Retention(): string {
        return core.getInput("retention-days");
    }

    static get Endpoint(): string {
        return core.getInput("nextcloud-url");
    }

    static get NoFileBehvaior(): NoFileOption {
        const notFoundAction = core.getInput("if-no-files-found");
        const noFileBehavior: NoFileOption = NoFileOption[notFoundAction as keyof typeof NoFileOption];

        if (!noFileBehavior) {
            core.setFailed(
                `Unrecognized ${"ifNoFilesFound"} input. Provided: ${notFoundAction}. Available options: ${Object.keys(
                    NoFileOption
                )}`
            );
        }

        return noFileBehavior;
    }
}
