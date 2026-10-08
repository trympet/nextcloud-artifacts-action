import type { URL } from 'node:url'
import type { NoFileOption } from './NoFileOption.js'

export interface Inputs {
  readonly ArtifactName: string

  readonly ArtifactPath: string

  readonly Endpoint: URL

  readonly Username: string

  readonly Password: string

  readonly Token: string

  readonly NoZip: boolean

  readonly NoFileBehvaior: NoFileOption
}
