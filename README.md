# Nextcloud Artifact Upload Action

Upload artifacts to Nextcloud and output a shareable URL.

## Requirements

This action uses Node.js 24, the newest JavaScript action runtime supported by
[GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax#runsusing-for-javascript-actions).
Self-hosted runners must be version **2.327.1 or newer**. The runner supplies Node.js;
consumers do not need a `setup-node` step to use this action.

The GitHub token needs `checks: write` to publish the artifact's check run. Store the
Nextcloud credentials in repository or environment secrets, and use a Nextcloud app
password where possible. The resulting share is public and read-only; only upload
files intended to be shared publicly.
The existing 1 GiB limit applies to the compressed ZIP archive.

## How it looks

![image](https://user-images.githubusercontent.com/23460729/120891750-7f247380-c60a-11eb-9998-3b3b7f61066f.png)

## Example

Globbing is supported. Build the files to upload before the Nextcloud step.

```yaml
on:
  pull_request:
  push:

permissions:
  contents: read
  checks: write

jobs:
  build-test:
    name: Build & Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - name: Nextcloud Artifact
        id: artifact
        if: >-
          github.actor != 'dependabot[bot]' &&
          (github.event_name != 'pull_request' ||
          github.event.pull_request.head.repo.full_name == github.repository)
        uses: trympet/nextcloud-artifacts-action@v2
        with:
          name: 'my-artifact'
          path: 'bin/**/*.exe'
          nextcloud-url: 'https://nextcloud.example.com'
          nextcloud-username: ${{ secrets.NEXTCLOUD_USERNAME }}
          nextcloud-password: ${{ secrets.NEXTCLOUD_PASSWORD }}
```

For production, pin this action to a full commit SHA from a reviewed release.
The example skips uploads on fork and Dependabot pull requests, which do not
receive the required secrets or a writable token. Do not use `pull_request_target`
to run untrusted pull-request code with secrets.

## Output

`steps.artifact.outputs.SHAREABLE_URL` contains the public URL after a successful
upload. No output is produced when there are no matching files. The
`if-no-files-found` input accepts `warn` (default), `error`, or `ignore`.

## Development

Use Node.js 24, as specified in `.node-version`.
TypeScript is kept on the newest 6.0 patch supported by the test and lint tools;
ESLint stays on version 9 until all GitHub lint plugins support version 10.

```sh
npm ci
npm run format-check
npm run lint
npm test
```

`npm test` recompiles the action and exercises the standalone bundle against local
GitHub and Nextcloud test servers; it does not require secrets or a real Nextcloud
server. To recompile without running tests, use `npm run package`.

Commit all generated files in `dist/`, including per-bundle license notices, with
source or dependency changes. CI checks formatting, linting, the build, behavior,
and bundle freshness on Ubuntu. Dependabot checks npm dependencies and pinned
workflow actions weekly.

The live integration test is opt-in: run `npm run test:integration` with
`ARTIFACT_NAME`, `ARTIFACT_PATH`, `ENDPOINT`, `USERNAME`, `PASSWORD`, `TOKEN`,
`GITHUB_REPOSITORY`, `GITHUB_SHA`, and `GITHUB_RUN_ID` set in the environment or an
untracked `.env` file. It uploads to the configured Nextcloud server and creates a
real GitHub check run.
