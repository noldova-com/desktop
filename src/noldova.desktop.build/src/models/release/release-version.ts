/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class ReleaseVersion {
  private readonly major: number;
  private readonly minor: number;
  private readonly patch: number;

  public readonly text: string;

  private constructor(text: string, major: number, minor: number, patch: number) {
    this.text = text;
    this.major = major;
    this.minor = minor;
    this.patch = patch;
  }

  public static parse(text: string, source: string): ReleaseVersion {
    const match = Resources.releaseVersionPattern.exec(text);
    if (Object.isNull(match))
      throw new BuildException(Resources.formatReleaseVersionInvalid(source, text));
    return new ReleaseVersion(text, Number(match[1]), Number(match[2]), Number(match[3]));
  }

  public isNewerThan(other: ReleaseVersion): boolean {
    if (this.major !== other.major)
      return this.major > other.major;
    if (this.minor !== other.minor)
      return this.minor > other.minor;
    return this.patch > other.patch;
  }
}
