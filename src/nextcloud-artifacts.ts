import { Inputs } from './Inputs';
import { NextcloudArtifact } from './nextcloud/NextcloudArtifact';
import * as core from '@actions/core';

try {
    var artifact = new NextcloudArtifact(Inputs.ArtifactName, Inputs.ArtifactPath, Inputs.NoFileBehvaior);
    artifact.run()
        .catch(e => core.setFailed(e));
    core.info("Finished");
} catch (error) {
    core.setFailed(error.message);
}
