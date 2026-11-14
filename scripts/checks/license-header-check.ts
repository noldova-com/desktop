/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import type { RepositoryFiles } from "../structure/repository-files.ts";
import { LicenseHeaderNotice } from "../structure/license-header-notice.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";
import { Resources as BuildResources } from "../../src/noldova.desktop.build/src/resources.ts";

export class LicenseHeaderCheck implements ICheck {
  private static readonly HEADERS: ReadonlyMap<string, string> = new Map([
    ...[...Resources.sourceScriptExtensions, ...Resources.sourceStyleExtensions].map(t => [t, BuildResources.licenseHeaderBlock] as const),
    [Resources.htmlExtension, LicenseHeaderNotice.MARKUP],
    ...Resources.licenseHeaderYamlExtensions.map(t => [t, LicenseHeaderNotice.YAML] as const)
  ]);

  private readonly root: string;
  private readonly files: RepositoryFiles;

  public readonly title: string = Resources.licenseHeaderCheckTitle;

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    let checked = 0;
    let failures = 0;
    for (const file of await this.files.listAsync()) {
      const header = LicenseHeaderCheck.HEADERS.get(path.posix.extname(file));
      if (Object.isUndefined(header))
        continue;
      checked++;
      if ((await readFile(path.join(this.root, file), Resources.encoding)).replace(Resources.interpreterLinePattern, String.empty).startsWith(header))
        continue;
      output.write(Resources.formatLicenseHeaderMissing(file));
      failures++;
    }
    output.write(Resources.formatLicenseHeaderChecked(checked));
    return failures === 0;
  }
}
