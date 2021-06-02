"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Inputs_1 = require("./Inputs");
const NextcloudArtifact_1 = require("./nextcloud/NextcloudArtifact");
var artifact = new NextcloudArtifact_1.NextcloudArtifact(Inputs_1.Inputs.ArtifactName, Inputs_1.Inputs.ArtifactPath, Inputs_1.Inputs.NoFileBehvaior);
artifact.run();
//# sourceMappingURL=index.js.map