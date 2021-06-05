/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Inputs } from '../../src/Inputs'
import { NoFileOption } from '../../src/NoFileOption'

export class InputsDouble implements Inputs {
  get ArtifactName(): string {
    return process.env['ARTIFACT_NAME']!
  }

  get ArtifactPath(): string {
    return process.env['ARTIFACT_PATH']!
  }

  get Retention(): string {
    return ''
  }

  get Endpoint(): URL {
    return new URL(process.env['ENDPOINT']!)
  }

  get Username(): string {
    return process.env['USERNAME']!
  }

  get Password(): string {
    return process.env['PASSWORD']!
  }

  get Token(): string {
    return process.env['TOKEN']!
  }

  get NoFileBehvaior(): NoFileOption {
    return NoFileOption.error
  }
}
