/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class UpdateVersion {
  private readonly parts: readonly number[];
  private readonly internal: number | null;

  private constructor(parts: readonly number[], internal: number | null) {
    this.parts = parts;
    this.internal = internal;
  }

  public static parse(text: string): UpdateVersion | null {
    const match = Resources.updateVersionPattern.exec(text);
    if (Object.isNull(match))
      return null;
    const [, major, minor, patch, internal] = match;
    return new UpdateVersion([major, minor, patch].map(Number), Object.isUndefined(internal) ? null : Number(internal));
  }

  public static isOffered(text: string): boolean {
    return !Object.isNull(UpdateVersion.parse(text));
  }

  public static isNewer(text: string, current: string): boolean {
    const next = UpdateVersion.parse(text);
    const installed = UpdateVersion.parse(current);
    return !Object.isNull(next) && !Object.isNull(installed) && next.compareTo(installed) > 0;
  }

  private compareTo(other: UpdateVersion): number {
    const index = this.parts.findIndex((t, i) => t !== other.parts[i]);
    if (index >= 0)
      return Number(this.parts[index]) - Number(other.parts[index]);
    if (this.internal === other.internal)
      return 0;
    if (Object.isNull(this.internal))
      return 1;
    return Object.isNull(other.internal) ? -1 : this.internal - other.internal;
  }
}
