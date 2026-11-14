/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import type { BuildLayout } from "./build-layout.ts";
import { InstalledPackages } from "./installed-packages.ts";
import { PackageNaming } from "./package-naming.ts";
import { Resources } from "../../resources.ts";

export class InstalledTreeCheck {
  private readonly layout: BuildLayout;

  public constructor(layout: BuildLayout) {
    this.layout = layout;
  }

  public async checkAsync(): Promise<void> {
    await this.checkOneCopyAsync();
    for (const name of Resources.nodeSidePackages) {
      const folder = InstalledPackages.resolve(this.layout.root, this.layout.root, name);
      const trail = Object.isNull(folder) ? null : await this.findAngularAsync(folder, name);
      if (!Object.isNull(trail))
        throw new BuildException(Resources.formatNodeSideAngular(name, trail));
    }
  }

  private async checkOneCopyAsync(): Promise<void> {
    const app = this.layout.windowAppFolder;
    const installed = [...await InstalledPackages.listAsync(this.layout.root), ...Object.isNull(app) ? [] : await InstalledPackages.listAsync(app)];
    for (const [name, location] of installed)
      if ((PackageNaming.isShared(name) || PackageNaming.isAngular(name)) && location !== this.layout.locateInstalledPackage(name))
        throw new BuildException(Resources.formatSecondCopy(name, path.relative(this.layout.root, location).split(path.sep).join(Resources.pathSegmentSeparator)));
  }

  private async findAngularAsync(start: string, name: string): Promise<readonly string[] | null> {
    const visited = new Set<string>([start]);
    const pending: (readonly [string, readonly string[]])[] = [[start, [name]]];
    for (let item = pending.shift(); !Object.isUndefined(item); item = pending.shift()) {
      const [folder, trail] = item;
      for (const dependency of await InstalledPackages.readDependencyNamesAsync(folder, Resources.nodeSideDependencyFields)) {
        if (PackageNaming.isAngular(dependency))
          return [...trail, dependency];
        const resolved = InstalledPackages.resolve(this.layout.root, folder, dependency);
        if (!Object.isNull(resolved) && !visited.has(resolved)) {
          visited.add(resolved);
          pending.push([resolved, [...trail, dependency]]);
        }
      }
    }
    return null;
  }
}
