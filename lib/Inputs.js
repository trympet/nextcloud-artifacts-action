"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Inputs = void 0;
const core_1 = __importDefault(require("@actions/core"));
const NoFileOption_1 = require("./NoFileOption");
class Inputs {
    static get ArtifactName() {
        return core_1.default.getInput("name");
    }
    static get ArtifactPath() {
        return core_1.default.getInput("path");
    }
    static get Retention() {
        return core_1.default.getInput("retention-days");
    }
    static get Endpoint() {
        return core_1.default.getInput("nextcloud-url");
    }
    static get Username() {
        return core_1.default.getInput("nextcloud-username");
    }
    static get Password() {
        return core_1.default.getInput("nextcloud-password");
    }
    static get NoFileBehvaior() {
        const notFoundAction = core_1.default.getInput("if-no-files-found");
        const noFileBehavior = NoFileOption_1.NoFileOption[notFoundAction];
        if (!noFileBehavior) {
            core_1.default.setFailed(`Unrecognized ${"ifNoFilesFound"} input. Provided: ${notFoundAction}. Available options: ${Object.keys(NoFileOption_1.NoFileOption)}`);
        }
        return noFileBehavior;
    }
}
exports.Inputs = Inputs;
//# sourceMappingURL=Inputs.js.map