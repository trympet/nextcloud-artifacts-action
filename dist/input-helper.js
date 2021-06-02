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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInputs = void 0;
const core = __importStar(require("@actions/core"));
const constants_1 = require("./constants");
/**
 * Helper to get all the inputs for the action
 */
function getInputs() {
    const name = core.getInput(constants_1.Inputs.Name);
    const path = core.getInput(constants_1.Inputs.Path, { required: true });
    const ifNoFilesFound = core.getInput(constants_1.Inputs.IfNoFilesFound);
    const noFileBehavior = constants_1.NoFileOptions[ifNoFilesFound];
    if (!noFileBehavior) {
        core.setFailed(`Unrecognized ${constants_1.Inputs.IfNoFilesFound} input. Provided: ${ifNoFilesFound}. Available options: ${Object.keys(constants_1.NoFileOptions)}`);
    }
    const inputs = {
        artifactName: name,
        searchPath: path,
        ifNoFilesFound: noFileBehavior
    };
    const retentionDaysStr = core.getInput(constants_1.Inputs.RetentionDays);
    if (retentionDaysStr) {
        inputs.retentionDays = parseInt(retentionDaysStr);
        if (isNaN(inputs.retentionDays)) {
            core.setFailed('Invalid retention-days');
        }
    }
    return inputs;
}
exports.getInputs = getInputs;
//# sourceMappingURL=input-helper.js.map