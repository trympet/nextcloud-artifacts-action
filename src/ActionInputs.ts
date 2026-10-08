import * as core from '@actions/core'
import { NoFileOption } from './NoFileOption.js'
import type { Inputs } from './Inputs.js'
import { URL } from 'node:url'

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
    const password = core.getInput('nextcloud-password', { required: true })
    core.setSecret(password)
    return password
  }

  get Token(): string {
    const token = core.getInput('token', { required: true })
    core.setSecret(token)
    return token
  }

  get NoZip(): boolean {
    return core.getInput('no-zip') ? core.getBooleanInput('no-zip') : false
  }

  get NoFileBehvaior(): NoFileOption {
    const notFoundAction = core.getInput('if-no-files-found', { required: false }) || NoFileOption.warn
    const noFileBehavior = Object.values(NoFileOption).find(option => option === notFoundAction)

    if (!noFileBehavior) {
      throw new Error(
        `Unrecognized if-no-files-found input. Provided: ${notFoundAction}. Available options: ${Object.keys(
          NoFileOption
        )}`
      )
    }

    return noFileBehavior
  }
}
