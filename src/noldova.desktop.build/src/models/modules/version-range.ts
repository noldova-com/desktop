/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.ts";

export class VersionRange {
  public readonly minimum: string;
  public readonly below: string;

  private constructor(minimum: string, below: string) {
    this.minimum = minimum;
    this.below = below;
  }

  public static isVersion(text: string): boolean {
    return Resources.versionPattern.test(text);
  }

  public static parse(text: string): VersionRange | null {
    const match = Resources.versionRangePattern.exec(text);
    if (Object.isNull(match))
      return null;
    const minimum = String(match[1]);
    const below = String(match[2]);
    if (!VersionRange.isVersion(minimum) || !VersionRange.isVersion(below) || VersionRange.compare(minimum, below) >= 0)
      return null;
    return new VersionRange(minimum, below);
  }

  public static following(lowest: string): VersionRange | null {
    return VersionRange.isVersion(lowest) ? new VersionRange(lowest, VersionRange.firstRefusedAfter(lowest)) : null;
  }

  public includes(version: string): boolean {
    return VersionRange.isVersion(version) && VersionRange.compare(version, this.minimum) >= 0 && VersionRange.compare(version, this.below) < 0;
  }

  public isFollowing(): boolean {
    return this.below === VersionRange.firstRefusedAfter(this.minimum);
  }

  public newestOf(versions: readonly string[]): string | null {
    return versions.filter(t => this.includes(t)).sort(VersionRange.compare).at(-1) ?? null;
  }

  public toString(): string {
    return Resources.formatVersionRange(this.minimum, this.below);
  }

  private static firstRefusedAfter(lowest: string): string {
    const [major, minor] = lowest.split(Resources.versionSeparator);
    return Number(major) === 0 ? Resources.formatVersion(0, Number(minor) + 1, 0) : Resources.formatVersion(Number(major) + 1, 0, 0);
  }

  private static compare(left: string, right: string): number {
    const first = left.split(Resources.versionSeparator);
    const second = right.split(Resources.versionSeparator);
    for (let index = 0; index < Resources.versionPartCount; index++) {
      const difference = Number(first[index]) - Number(second[index]);
      if (difference !== 0)
        return difference;
    }
    return 0;
  }
}
