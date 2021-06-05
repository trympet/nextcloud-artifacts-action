import { NextcloudArtifact } from '../src/nextcloud/NextcloudArtifact'
import { InputsDouble } from './doubles/InputsDouble'

describe('integration tests', () => {
  it('works', async () => {
    const artifact = new NextcloudArtifact(new InputsDouble())
    await artifact.run()
  })
})
