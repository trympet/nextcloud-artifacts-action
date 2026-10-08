import { describe, it } from '@jest/globals'
import { NextcloudArtifact } from '../src/nextcloud/NextcloudArtifact.js'
import { InputsDouble } from './doubles/InputsDouble.js'

describe('integration tests', () => {
  it('works', async () => {
    const artifact = new NextcloudArtifact(new InputsDouble())
    await artifact.run()
  })
})
