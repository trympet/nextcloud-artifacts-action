import * as core from '@actions/core'
import { NoFileOption } from './NoFileOption'
import { Inputs } from './Inputs'

export class ActionInputs implements Inputs {
  get ArtifactName(): string {
    return core.getInput('name')
  }

  get ArtifactPath(): string {
    return core.getInput('path')
  }

  get Retention(): string {
    return core.getInput('retention-days')
  }

  get Endpoint(): string {
    return core.getInput('nextcloud-url')
  }

  get Username(): string {
    return core.getInput('nextcloud-username')
  }

  get Password(): string {
    return core.getInput('nextcloud-password')
  }

  get Token(): string {
    return core.getInput('token', { required: true })
  }

  get NoFileBehvaior(): NoFileOption {
    const notFoundAction = core.getInput('if-no-files-found') || NoFileOption.warn
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
