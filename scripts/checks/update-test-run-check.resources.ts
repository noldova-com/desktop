/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.ts";

export class UpdateTestRunCheckResources {
  public static readonly title: string = "Update test runs";
  public static readonly releaseWorkflow: string = ".github/workflows/release-app.yml";
  public static readonly packageWorkflow: string = ".github/workflows/package-app.yml";
  public static readonly publishJob: string = "publish";
  public static readonly packageJob: string = "package";
  public static readonly buildJobs: readonly string[] = ["build", "build-signed"];
  public static readonly publishStep: string = "Publish the release";
  public static readonly assetsStep: string = "Write the checksums and the update information";
  public static readonly keepStep: string = "Keep the release files";
  public static readonly keepCondition: string = "if: ${{ inputs.keep-release-files }}";
  public static readonly keepInput: string = "keep-release-files: true";
  public static readonly publishCondition: RegExp = /^ {4}if: \$\{\{ (.+) && inputs\.update-feed == '' \}\}$/;
  public static readonly publishGuard: string = "RELEASE_UPDATE_FEED: ${{ inputs.update-feed }}";
  public static readonly assetsFeed: string = "UPDATE_FEED: ${{ inputs.update-feed }}";
  public static readonly assetsCommand: string = "npm run release:assets -- --update-feed \"$UPDATE_FEED\"";
  public static readonly keptFiles: readonly string[] = ["-*.exe", "-*.dmg", "-*.zip", "-*.AppImage", "-*.sha256", "latest-*.yml"];
  public static readonly noFilesFail: string = "if-no-files-found: error";
  public static readonly feedNames: RegExp = /update-feed|UPDATE_FEED/;
  public static readonly condition: RegExp = /^\s*if:/;
  public static readonly stepStart: RegExp = /^(\s*)- name: (.+)$/;
  public static readonly topLevelOr: string = "||";
  public static readonly openParenthesis: string = "(";
  public static readonly closeParenthesis: string = ")";
  public static readonly lineSeparator: RegExp = /\r?\n/;
  public static readonly rule: string = "documents/BUILD.md, Publication, says a test of updating keeps its packages and update information as artifacts and publishes nothing.";
  public static readonly jobBodyStart: string = `${Resources.indent} `;
  public static readonly checkedLine: string = `Checked that ${UpdateTestRunCheckResources.releaseWorkflow} runs no publish job with update-feed set and asks ${UpdateTestRunCheckResources.packageWorkflow} to keep its release files, and that ${UpdateTestRunCheckResources.packageWorkflow} keeps them when asked.${Resources.lineEnd}`;
  public static readonly unguardedPublish: string = `${UpdateTestRunCheckResources.releaseWorkflow}: the ${UpdateTestRunCheckResources.publishJob} job's if does not end in "&& inputs.update-feed == ''" with no top-level "||" before it, so a test run with update-feed set could reach the publish environment.`;
  public static readonly unpassedGuard: string = `${UpdateTestRunCheckResources.releaseWorkflow}: the "${UpdateTestRunCheckResources.publishStep}" step does not pass ${UpdateTestRunCheckResources.publishGuard}, which release-publish refuses to publish with.`;
  public static readonly unwrittenAssets: string = `${UpdateTestRunCheckResources.packageWorkflow}: the "${UpdateTestRunCheckResources.assetsStep}" step does not always run with ${UpdateTestRunCheckResources.assetsFeed} and ${UpdateTestRunCheckResources.assetsCommand}, so a test run's release files would not be written against its feed.`;

  public static formatRuledFinding(finding: string): string {
    return `${finding} ${UpdateTestRunCheckResources.rule}${Resources.lineEnd}`;
  }

  public static formatNoJob(workflow: string, job: string): string {
    return `${workflow} has no ${job} job.`;
  }

  public static formatUnkeptInput(job: string): string {
    return `${UpdateTestRunCheckResources.releaseWorkflow}: the ${job} job does not pass ${UpdateTestRunCheckResources.keepInput} to ${UpdateTestRunCheckResources.packageWorkflow}, so its release files would not reach the publish job or a test of updating.`;
  }

  public static formatFeedCondition(line: string): string {
    return `${UpdateTestRunCheckResources.packageWorkflow}: a condition in the ${UpdateTestRunCheckResources.packageJob} job depends on the update feed, so a test run could skip a step: ${line}`;
  }

  public static formatUnkeptFiles(missing: readonly string[]): string {
    return `${UpdateTestRunCheckResources.packageWorkflow}: the "${UpdateTestRunCheckResources.keepStep}" step does not keep every package and its update information whenever its caller asks, and fail when one is missing${missing.length > 0 ? `; it leaves out ${missing.join(Resources.listSeparator)}` : String.empty}.`;
  }

  public static formatJobStart(name: string): string {
    return `${Resources.indent}${name}:`;
  }
}
