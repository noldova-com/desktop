/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { lstat, mkdir, readdir, readlink, rm } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { Resources } from "../../resources.ts";

export class MacUpdateArchiveCheck {
  private readonly runner: ProcessRunner;
  private readonly folder: string;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(runner: ProcessRunner, folder: string, environment: NodeJS.ProcessEnv) {
    this.runner = runner;
    this.folder = folder;
    this.environment = environment;
  }

  public async verifyAsync(archive: string, output: string, productName: string): Promise<string> {
    const bundle = `${productName}${Resources.appBundleExtension}`;
    const applications = (await readdir(output, { withFileTypes: true }))
      .filter(t => t.isDirectory() && existsSync(path.join(output, t.name, bundle)))
      .map(t => path.join(output, t.name, bundle));
    if (applications.length !== 1)
      throw new BuildException(Resources.formatMacUpdateCopies(applications.length, bundle, output, archive));
    const [application = bundle] = applications;
    await rm(this.folder, { recursive: true, force: true });
    await mkdir(this.folder, { recursive: true });
    try {
      await this.runner.requireAsync(Resources.dittoCommand, [...Resources.dittoExtractArguments, archive, this.folder], this.folder, Resources.macUpdateArchiveTimeout,
        this.environment);
      const extracted = path.join(this.folder, path.basename(application));
      const expected = await MacUpdateArchiveCheck.describeAsync(application);
      const actual = await MacUpdateArchiveCheck.describeAsync(extracted);
      const frameworks = [...actual.keys()].filter(t => t.endsWith(Resources.frameworkExtension) && actual.get(t) === Resources.macUpdateFolderEntry);
      const unlinked = frameworks.filter(t => !(actual.get([t, ...Resources.frameworkCurrentVersionSegments].join(Resources.pathSegmentSeparator)) ?? String.empty)
        .startsWith(Resources.macUpdateLinkPrefix));
      if (unlinked.length > 0)
        throw new BuildException(Resources.formatMacUpdateUnlinked(archive, unlinked));
      const differences = [...new Set([...expected.keys(), ...actual.keys()])].sort()
        .filter(t => expected.get(t) !== actual.get(t))
        .map(t => Resources.formatMacUpdateDifference(t, expected.get(t) ?? Resources.macUpdateMissingEntry, actual.get(t) ?? Resources.macUpdateMissingEntry));
      if (differences.length > 0)
        throw new BuildException(Resources.formatMacUpdateDifferences(archive, differences.length,
          differences.slice(0, Resources.macUpdateShownDifferences)));
      return Resources.formatMacUpdateVerified(archive, actual.size, frameworks.length);
    }
    finally {
      await rm(this.folder, { recursive: true, force: true });
    }
  }

  private static async describeAsync(root: string): Promise<Map<string, string>> {
    const entries = new Map<string, string>();
    const pending: string[] = [String.empty];
    for (let relative = pending.pop(); !Object.isUndefined(relative); relative = pending.pop()) {
      for (const name of await readdir(path.join(root, ...relative.split(Resources.pathSegmentSeparator)))) {
        const entry = relative.length === 0 ? name : `${relative}${Resources.pathSegmentSeparator}${name}`;
        const file = path.join(root, ...entry.split(Resources.pathSegmentSeparator));
        const status = await lstat(file);
        if (status.isSymbolicLink())
          entries.set(entry, Resources.formatMacUpdateLink(path.relative(path.dirname(file), path.resolve(path.dirname(file), await readlink(file))).split(path.sep)
            .join(Resources.pathSegmentSeparator)));
        else if (status.isDirectory()) {
          entries.set(entry, Resources.macUpdateFolderEntry);
          pending.push(entry);
        }
        else
          entries.set(entry, Resources.formatMacUpdateFileEntry(status.size));
      }
    }
    return entries;
  }
}
