/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.ts";

export class BuildPart {
  public static readonly WHOLE: BuildPart = new BuildPart(null);

  public readonly part: number | null;

  private constructor(part: number | null) {
    this.part = part;
  }

  public get hasPackageTests(): boolean {
    return this.part !== Resources.buildOtherChecksPart;
  }

  public get hasWindowChecks(): boolean {
    return this.part !== Resources.buildPackageTestsPart;
  }

  public static of(part: number | null): BuildPart {
    return Object.isNull(part) ? BuildPart.WHOLE : new BuildPart(part);
  }

  public static parse(commandArguments: readonly string[]): BuildPart {
    const match = commandArguments.length === 1 ? Resources.buildPartPattern.exec(commandArguments.join(String.empty)) : null;
    return Object.isNull(match) ? BuildPart.WHOLE : new BuildPart(Number(match[1]));
  }

  public removeFrom(commandArguments: readonly string[]): readonly string[] {
    return Object.isNull(this.part) ? commandArguments : [];
  }
}
