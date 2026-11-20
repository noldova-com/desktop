/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import "@noldova/context.core";

import { ProcessResult } from "../../src/models/processes/process-result.js";
import { ProcessRunner } from "../../src/services/processes/process-runner.js";
import { GitHubReleasesFixture } from "./github-releases.fixture.js";

export interface ICommitRecord {
  readonly message: string;
  readonly tree: string;
  readonly parent: string | null;
}

export class GitHubLockFixture extends ProcessRunner {
  public static readonly REFERENCE: string = "refs/locks/release";

  private nextCommit: number = 0;

  public readonly commits: Map<string, ICommitRecord> = new Map();
  public readonly runs: Map<string, string> = new Map();
  public readonly requests: string[] = [];
  public lock: string | null = null;
  public intercept: (request: readonly string[]) => ProcessResult | null = () => null;

  public addCommit(message: string, parent: string | null = null, tree: string | null = null): string {
    this.nextCommit += 1;
    const sha = this.nextCommit.toString(16).padStart(40, "0");
    this.commits.set(sha, { message, tree: tree ?? `tree-of-${sha}`, parent });
    return sha;
  }

  public hold(run: string | null, status: string | null = "in_progress"): string {
    this.lock = this.addCommit(Object.isNull(run) ? "A commit someone made" : `Release lock for run ${run}`);
    if (!Object.isNull(run) && !Object.isNull(status))
      this.runs.set(run, status);
    return this.lock;
  }

  public holder(): string | null {
    return Object.isNull(this.lock) ? null : this.commits.get(this.lock)?.message ?? null;
  }

  public override async captureAsync(_command: string, commandArguments: readonly string[], _directory: string, _timeout: number, _environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    this.requests.push(commandArguments.join(" "));
    return await Promise.resolve(this.intercept(commandArguments) ?? this.answer(commandArguments));
  }

  private answer(commandArguments: readonly string[]): ProcessResult {
    const method = commandArguments[1] === "--method" ? commandArguments[2] ?? String.empty : "GET";
    const resource = (commandArguments.find(t => t.startsWith("repos/")) ?? String.empty).split("/").slice(3).join("/");
    const fields = new Map<string, string>();
    commandArguments.forEach((t, index) => {
      const option = commandArguments[index - 1];
      if (option === "--raw-field" || option === "--field")
        fields.set(t.slice(0, t.indexOf("=")), t.slice(t.indexOf("=") + 1));
    });
    if (method === "GET" && resource === "git/ref/locks/release")
      return Object.isNull(this.lock) ? GitHubReleasesFixture.fail(404) : GitHubReleasesFixture.ok({ ref: GitHubLockFixture.REFERENCE, object: { type: "commit", sha: this.lock } });
    if (method === "GET" && resource.startsWith("git/commits/")) {
      const sha = resource.slice("git/commits/".length);
      const commit = this.commits.get(sha);
      return Object.isUndefined(commit) ? GitHubReleasesFixture.fail(404) : GitHubReleasesFixture.ok({ sha, message: commit.message, tree: { sha: commit.tree } });
    }
    if (method === "POST" && resource === "git/commits")
      return GitHubReleasesFixture.ok({ sha: this.addCommit(fields.get("message") ?? String.empty, fields.get("parents[]") ?? null, fields.get("tree") ?? null) });
    if (method === "POST" && resource === "git/refs") {
      if (!Object.isNull(this.lock) || fields.get("ref") !== GitHubLockFixture.REFERENCE)
        return GitHubReleasesFixture.fail(422);
      this.lock = fields.get("sha") ?? null;
      return GitHubReleasesFixture.ok({ ref: GitHubLockFixture.REFERENCE });
    }
    if (method === "PATCH" && resource === "git/refs/locks/release") {
      const sha = fields.get("sha") ?? String.empty;
      if (Object.isNull(this.lock) || fields.get("force") !== "false" || this.commits.get(sha)?.parent !== this.lock)
        return GitHubReleasesFixture.fail(422);
      this.lock = sha;
      return GitHubReleasesFixture.ok({ ref: GitHubLockFixture.REFERENCE });
    }
    if (method === "DELETE" && resource === "git/refs/locks/release" && !Object.isNull(this.lock)) {
      this.lock = null;
      return new ProcessResult(0, String.empty, String.empty);
    }
    if (method === "GET" && resource.startsWith("actions/runs/")) {
      const status = this.runs.get(resource.slice("actions/runs/".length));
      return Object.isUndefined(status) ? GitHubReleasesFixture.fail(404) : GitHubReleasesFixture.ok({ status });
    }
    return GitHubReleasesFixture.fail(404);
  }
}
