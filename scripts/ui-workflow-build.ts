/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class UiWorkflowBuild {
  public readonly buildArguments: readonly string[];
  public readonly output: readonly string[];
  public readonly spec: string | null;

  public constructor(buildArguments: readonly string[], output: readonly string[], spec: string | null = null) {
    this.buildArguments = buildArguments;
    this.output = output;
    this.spec = spec;
  }

  private static readonly LISTING_SEPARATORS: RegExp = /[\s/\\]+/;

  public static choose(builds: readonly UiWorkflowBuild[], listing: string | null, isBuilt: (build: UiWorkflowBuild) => boolean): readonly UiWorkflowBuild[] {
    const listed = Object.isNull(listing) ? null : listing.split(UiWorkflowBuild.LISTING_SEPARATORS);
    return builds.filter(t => Object.isNull(t.spec) || isBuilt(t) || Object.isNull(listed) || listed.some(part => part.startsWith(`${String(t.spec)}:`)));
  }
}
