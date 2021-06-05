import { URL } from 'url'
import { NoFileOption } from './NoFileOption'

export interface Inputs {
  readonly ArtifactName: string

  readonly ArtifactPath: string

  readonly Endpoint: URL

  readonly Username: string

  readonly Password: string

  readonly Token: string

  readonly NoFileBehvaior: NoFileOption
}
