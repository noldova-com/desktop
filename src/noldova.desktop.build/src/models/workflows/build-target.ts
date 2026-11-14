/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";

export class BuildTarget {
  public readonly name: string;
  public readonly runnerName: string;
  public readonly architecture: string;
  public readonly packagesEachNight: boolean;

  public constructor(name: string, runnerName: string, architecture: string, packagesEachNight: boolean) {
    this.name = name;
    this.runnerName = runnerName;
    this.architecture = architecture;
    this.packagesEachNight = packagesEachNight;
  }

  public get platform(): string {
    return this.name.slice(0, this.name.indexOf(Resources.targetNameWordSeparator)).toLowerCase();
  }
}
