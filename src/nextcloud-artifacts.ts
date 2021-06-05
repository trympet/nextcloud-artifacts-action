import { NextcloudArtifact } from './nextcloud/NextcloudArtifact'
import * as core from '@actions/core'
import { ActionInputs } from './ActionInputs'

async function run() {
  try {
    const artifact = new NextcloudArtifact(new ActionInputs())
    await artifact.run()
    core.info('Finished')
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
