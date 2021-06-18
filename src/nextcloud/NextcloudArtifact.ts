import * as core from '@actions/core'
import * as github from '@actions/github'
import { GitHub } from '@actions/github/lib/utils'

import { FileFinder } from '../FileFinder'
import { Inputs } from '../Inputs'
import { NextcloudClient } from './NextcloudClient'
import { NoFileOption } from '../NoFileOption'

export class NextcloudArtifact {
  readonly octokit: InstanceType<typeof GitHub>
  readonly context = NextcloudArtifact.getCheckRunContext()
  readonly token: string
  readonly name: string
  readonly artifactTitle: string
  readonly path: string
  readonly errorBehavior: NoFileOption

  constructor(private inputs: Inputs) {
    this.token = inputs.Token
    this.name = inputs.ArtifactName
    this.artifactTitle = `Nextcloud - ${this.name}`
    this.path = inputs.ArtifactPath
    this.errorBehavior = inputs.NoFileBehvaior
    this.name = inputs.ArtifactName
    this.octokit = github.getOctokit(this.token)
  }

  async run() {
    const fileFinder = new FileFinder(this.path)
    const files = await fileFinder.findFiles()

    if (files.filesToUpload.length > 0) {
      await this.uploadFiles(files)
    } else {
      this.logNoFilesFound()
    }
  }

  private static getCheckRunContext(): { sha: string; runId: number } {
    if (github.context.eventName === 'workflow_run') {
      core.info('Action was triggered by workflow_run: using SHA and RUN_ID from triggering workflow')
      const event = github.context.payload
      if (!event.workflow_run) {
        throw new Error("Event of type 'workflow_run' is missing 'workflow_run' field")
      }
      return {
        sha: event.workflow_run.head_commit.id,
        runId: event.workflow_run.id
      }
    }

    const runId = github.context.runId
    if (github.context.payload.pull_request) {
      core.info(`Action was triggered by ${github.context.eventName}: using SHA from head of source branch`)
      const pr = github.context.payload.pull_request
      return { sha: pr.head.sha, runId }
    }

    return { sha: github.context.sha, runId }
  }

  private async uploadFiles(files: { filesToUpload: string[]; rootDirectory: string }) {
    this.logUpload(files.filesToUpload.length, files.rootDirectory)
    const createResp = await this.octokit.rest.checks.create({
      head_sha: this.context.sha,
      name: this.artifactTitle,
      status: 'in_progress',
      output: {
        title: `Nextcloud - ${this.name}`,
        summary: 'Uploading...'
      },
      ...github.context.repo
    })

    const client = new NextcloudClient(
      this.inputs.Endpoint,
      this.name,
      files.rootDirectory,
      this.inputs.Username,
      this.inputs.Password
    )

    try {
      const shareableUrl = await client.uploadFiles(files.filesToUpload)
      core.setOutput('SHAREABLE_URL', shareableUrl)
      core.info(`Nextcloud shareable URL: ${shareableUrl}`)
      const resp = await this.octokit.rest.checks.update({
        check_run_id: createResp.data.id,
        conclusion: 'success',
        status: 'completed',
        output: {
          title: this.artifactTitle,
          summary: shareableUrl
        },
        ...github.context.repo
      })
      core.info(`Check run create response: ${resp.status}`)
      core.info(`Check run URL: ${resp.data.url}`)
      core.info(`Check run HTML: ${resp.data.html_url}`)
    } catch (error) {
      await this.trySetFailed(createResp.data.id)
      core.setFailed(error)
    }
  }

  private async trySetFailed(checkId: number) {
    try {
      await this.octokit.rest.checks.update({
        check_run_id: checkId,
        conclusion: 'failure',
        status: 'completed',
        output: {
          title: this.artifactTitle,
          summary: 'Check failed.'
        },
        ...github.context.repo
      })
      return true
    } catch (error) {
      core.error(`Failed to update check status to failure`)
      return false
    }
  }

  private logUpload(fileCount: number, rootDirectory: string) {
    const s = fileCount === 1 ? '' : 's'
    core.info(`With the provided path, there will be ${fileCount} file${s} uploaded`)
    core.debug(`Root artifact directory is ${rootDirectory}`)

    if (fileCount > 10000) {
      core.warning(
        `There are over 10,000 files in this artifact, consider create an archive before upload to improve the upload performance.`
      )
    }
  }

  private logNoFilesFound() {
    const errorMessage = `No files were found with the provided path: ${this.path}. No artifacts will be uploaded.`
    switch (this.errorBehavior) {
      case NoFileOption.warn: {
        core.warning(errorMessage)
        break
      }
      case NoFileOption.error: {
        core.setFailed(errorMessage)
        break
      }
      case NoFileOption.ignore: {
        core.info(errorMessage)
        break
      }
    }
  }
}
