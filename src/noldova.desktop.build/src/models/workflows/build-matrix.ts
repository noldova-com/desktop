/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BuildTarget } from "./build-target.ts";
import { Resources } from "../../resources.ts";

export class BuildMatrix {
  public static readonly TARGETS: readonly BuildTarget[] = [
    new BuildTarget(Resources.buildTargetLinuxX64, Resources.buildRunnerLinux, Resources.architectureX64, true),
    new BuildTarget(Resources.buildTargetLinuxArm64, Resources.buildRunnerLinuxArm64, Resources.architectureArm64, false),
    new BuildTarget(Resources.buildTargetWindowsX64, Resources.buildRunnerWindows, Resources.architectureX64, true),
    new BuildTarget(Resources.buildTargetWindowsArm64, Resources.buildRunnerWindowsArm64, Resources.architectureArm64, false),
    new BuildTarget(Resources.buildTargetMacosX64, Resources.buildRunnerMacos, Resources.architectureX64, false),
    new BuildTarget(Resources.buildTargetMacosArm64, Resources.buildRunnerMacosArm64, Resources.architectureArm64, false)
  ];
}
