import { NextcloudArtifact } from './nextcloud/NextcloudArtifact.js'
import * as core from '@actions/core'
import { ActionInputs } from './ActionInputs.js'

async function run() {
  try {
    const artifact = new NextcloudArtifact(new ActionInputs())
    await artifact.run()
    core.info('Finished')
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error))
  }
}

await run()
