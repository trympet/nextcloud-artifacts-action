import { Inputs } from './Inputs';
import { NextcloudArtifact } from './nextcloud/NextcloudArtifact';

var artifact = new NextcloudArtifact(Inputs.ArtifactName, Inputs.ArtifactPath, Inputs.NoFileBehvaior);
artifact.run();