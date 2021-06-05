import * as core from '@actions/core'
import { NoFileOption } from './NoFileOption'
import { Inputs } from './Inputs'
import { URL } from 'url'

export class ActionInputs implements Inputs {
  get ArtifactName(): string {
    return core.getInput('name', { required: false }) || 'Nextcloud Artifact'
  }

  get ArtifactPath(): string {
    return core.getInput('path', { required: true })
  }

  get Endpoint(): URL {
    return new URL(core.getInput('nextcloud-url', { required: true }))
  }

  get Username(): string {
    return core.getInput('nextcloud-username', { required: true })
  }

  get Password(): string {
    return core.getInput('nextcloud-password', { required: true })
  }

  get Token(): string {
    return core.getInput('token', { required: true })
  }

  get NoFileBehvaior(): NoFileOption {
    const notFoundAction = core.getInput('if-no-files-found', { required: false }) || NoFileOption.warn
    const noFileBehavior: NoFileOption = NoFileOption[notFoundAction as keyof typeof NoFileOption]

    if (!noFileBehavior) {
      core.setFailed(
        `Unrecognized ${'ifNoFilesFound'} input. Provided: ${notFoundAction}. Available options: ${Object.keys(
          NoFileOption
        )}`
      )
    }

    return noFileBehavior
  }
}
