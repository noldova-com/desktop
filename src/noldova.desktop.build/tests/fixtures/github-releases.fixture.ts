/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { ProcessResult } from "../../src/models/processes/process-result.js";
import { ProcessRunner } from "../../src/services/processes/process-runner.js";

export interface IAssetRecord {
  readonly id: number;
  readonly name: string;
  readonly size: number;
  readonly state: string;
  readonly digest: string | null;
}

export interface IReleaseRecord {
  readonly id: number;
  readonly tag: string;
  readonly target: string;
  isDraft: boolean;
  assets: IAssetRecord[];
}

export class GitHubReleasesFixture extends ProcessRunner {
  private nextId: number = 100;

  public readonly releases: IReleaseRecord[] = [];
  public readonly tags: Map<string, string> = new Map();
  public readonly requests: string[] = [];
  public defaultBranchHead: string | null = "abcdefabcdefabcdefabcdefabcdefabcdefabcd";
  public intercept: (request: readonly string[]) => ProcessResult | null = () => null;

  public static ok(value: unknown): ProcessResult {
    return new ProcessResult(0, JSON.stringify(value), String.empty);
  }

  public static fail(status: number): ProcessResult {
    return new ProcessResult(1, String.empty, `gh: request failed (HTTP ${status})\n`);
  }

  public static digest(bytes: Buffer): string {
    return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  }

  public addRelease(tag: string, target: string, isDraft: boolean, assets: IAssetRecord[] = []): IReleaseRecord {
    const release: IReleaseRecord = { id: this.createId(), tag, target, isDraft, assets };
    this.releases.push(release);
    return release;
  }

  public createAsset(name: string, bytes: Buffer, state: string = "uploaded"): IAssetRecord {
    return { id: this.createId(), name, size: bytes.length, state, digest: state === "uploaded" ? GitHubReleasesFixture.digest(bytes) : null };
  }

  public override async captureAsync(_command: string, commandArguments: readonly string[], _directory: string, _timeout: number, _environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    this.requests.push(commandArguments.join(" "));
    return this.intercept(commandArguments) ?? await this.answerAsync(commandArguments);
  }

  private static describe(release: IReleaseRecord): Readonly<Record<string, unknown>> {
    return { id: release.id, tag_name: release.tag, target_commitish: release.target, draft: release.isDraft, assets: release.assets };
  }

  private createId(): number {
    this.nextId += 1;
    return this.nextId;
  }

  private async answerAsync(commandArguments: readonly string[]): Promise<ProcessResult> {
    if (commandArguments[0] === "release")
      return await this.uploadAsync(commandArguments[2] ?? String.empty, commandArguments[3] ?? String.empty);
    const method = commandArguments[1] === "--method" ? commandArguments[2] ?? String.empty : "GET";
    const resource = (commandArguments.find(t => t.startsWith("repos/")) ?? String.empty).split("/").slice(3).join("/");
    const fields = new Map<string, string>();
    commandArguments.forEach((t, index) => {
      const option = commandArguments[index - 1];
      if (option === "--raw-field" || option === "--field")
        fields.set(t.slice(0, t.indexOf("=")), t.slice(t.indexOf("=") + 1));
    });
    const [first, second, third, ...rest] = resource.split("/");
    const release = this.releases.find(t => String(t.id) === second);
    if (method === "GET" && first === "releases" && Object.isUndefined(second))
      return GitHubReleasesFixture.ok([this.releases.map(t => GitHubReleasesFixture.describe(t))]);
    if (method === "GET" && first === "git" && second === "matching-refs" && third === "tags") {
      const tag = rest.join("/");
      const commit = this.tags.get(tag);
      return GitHubReleasesFixture.ok(Object.isUndefined(commit) ? [] : [{ ref: `refs/tags/${tag}`, object: { type: "commit", sha: commit } }]);
    }
    if (method === "GET" && first === "releases" && !Object.isUndefined(release))
      return GitHubReleasesFixture.ok(GitHubReleasesFixture.describe(release));
    if (method === "POST" && first === "releases" && Object.isUndefined(second))
      return GitHubReleasesFixture.ok(GitHubReleasesFixture.describe(
        this.addRelease(fields.get("tag_name") ?? String.empty, fields.get("target_commitish") ?? String.empty, fields.get("draft") === "true")));
    if (method === "PATCH" && first === "releases" && !Object.isUndefined(release)) {
      release.isDraft = fields.get("draft") === "true";
      if (!release.isDraft && !this.tags.has(release.tag) && !Object.isNull(this.defaultBranchHead))
        this.tags.set(release.tag, this.defaultBranchHead);
      return GitHubReleasesFixture.ok(GitHubReleasesFixture.describe(release));
    }
    if (method === "DELETE" && first === "releases" && second === "assets") {
      for (const owner of this.releases)
        owner.assets = owner.assets.filter(t => String(t.id) !== third);
      return new ProcessResult(0, String.empty, String.empty);
    }
    if (method === "POST" && first === "git" && second === "refs") {
      const tag = (fields.get("ref") ?? String.empty).replace("refs/tags/", String.empty);
      if (this.tags.has(tag))
        return GitHubReleasesFixture.fail(422);
      this.tags.set(tag, fields.get("sha") ?? String.empty);
      return GitHubReleasesFixture.ok({ ref: fields.get("ref") });
    }
    return GitHubReleasesFixture.fail(404);
  }

  private async uploadAsync(tag: string, file: string): Promise<ProcessResult> {
    const release = this.releases.find(t => t.tag === tag);
    if (Object.isUndefined(release))
      return GitHubReleasesFixture.fail(404);
    const name = path.basename(file);
    if (release.assets.some(t => t.name === name))
      return GitHubReleasesFixture.fail(422);
    release.assets.push(this.createAsset(name, await readFile(file)));
    return new ProcessResult(0, String.empty, String.empty);
  }
}
