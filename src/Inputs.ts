import { NoFileOption } from './NoFileOption'

export interface Inputs {
  readonly ArtifactName: string

  readonly ArtifactPath: string

  readonly Retention: string

  readonly Endpoint: string

  readonly Username: string

  readonly Password: string

  readonly Token: string

  readonly NoFileBehvaior: NoFileOption
}
