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
import { Resources } from "../../resources.ts";

export class ReleaseTargets {

  public static isRequired(target: PackageTarget, supported: readonly PackageTarget[] | null): boolean {
    return target.architecture === Resources.architectureX64
      && (Resources.releaseAlwaysBuiltTargets.includes(target.id) || Object.isNull(supported) || supported.some(t => t.id === target.id));
  }

  public static read(environment: NodeJS.ProcessEnv, supported: readonly PackageTarget[] | null): readonly PackageTarget[] {
    const all = PackageTarget.listAll();
    const text = environment[Resources.releaseTargetsVariable] ?? String.empty;
    const ids = text.split(Resources.releaseTargetsSeparator);
    if (text.length === 0 || new Set(ids).size !== ids.length || !ids.every(t => all.some(u => u.id === t)))
      throw new BuildException(Resources.formatReleaseTargetsInvalid(all.map(t => t.id), text));
    const targets = all.filter(t => ids.includes(t.id));
    const required = all.filter(t => ReleaseTargets.isRequired(t, supported));
    const missing = required.filter(t => !targets.includes(t));
    if (missing.length > 0)
      throw new BuildException(Resources.formatReleaseTargetsMissing(required.map(t => t.id), missing.map(t => t.id)));
    const unbuilt = (supported ?? []).filter(t => !targets.some(u => u.id === t.id));
    if (unbuilt.length > 0)
      throw new BuildException(Resources.formatReleaseTargetsUnbuilt(unbuilt.map(t => t.id)));
    return targets;
  }
}
