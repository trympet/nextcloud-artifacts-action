import { Inputs } from './Inputs';
import { NextcloudArtifact } from './nextcloud/NextcloudArtifact';
import * as core from '@actions/core';

try {
    var artifact = new NextcloudArtifact(Inputs.ArtifactName, Inputs.ArtifactPath, Inputs.NoFileBehvaior);
    artifact.run();
} catch (error) {
    core.setFailed(error.message);
}
