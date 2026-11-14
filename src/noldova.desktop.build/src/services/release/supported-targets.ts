/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { PackageTarget } from "../../models/packaging/package-target.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { ReleaseSettings } from "./release-settings.ts";
import { Resources } from "../../resources.ts";

export class SupportedTargets {
  public static async readAsync(root: string): Promise<readonly PackageTarget[] | null> {
    const targets = await SupportedTargets.inspectAsync(root);
    if (targets instanceof BuildException)
      throw targets;
    return targets;
  }

  public static async inspectAsync(root: string): Promise<readonly PackageTarget[] | BuildException | null> {
    const settings = await ReleaseSettings.inspectAsync(root, SupportedTargets.formatInvalid());
    if (settings instanceof BuildException)
      return settings;
    return settings.hasField(Resources.supportedTargetsField) ? SupportedTargets.parse(settings.readValue(Resources.supportedTargetsField)) : null;
  }

  private static parse(value: unknown): readonly PackageTarget[] | BuildException {
    if (!Array.isArray(value))
      return new BuildException(SupportedTargets.formatInvalid());
    const ids: readonly unknown[] = value;
    const targets = PackageTarget.listAll();
    if (new Set(ids).size !== ids.length || !ids.every(t => Object.isString(t) && targets.some(u => u.id === t)))
      return new BuildException(SupportedTargets.formatInvalid());
    return targets.filter(t => ids.includes(t.id));
  }

  private static formatInvalid(): string {
    return Resources.formatSupportedTargetsInvalid(PackageTarget.listAll().map(t => t.id));
  }
}
