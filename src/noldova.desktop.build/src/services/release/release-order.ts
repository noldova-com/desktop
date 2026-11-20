/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { GitHubRelease } from "../../models/release/github-release.ts";
import type { ReleaseRequest } from "../../models/release/release-request.ts";
import type { ReleaseVersion } from "../../models/release/release-version.ts";
import { Resources } from "../../resources.ts";

export class ReleaseOrder {
  public static readHighest(releases: readonly GitHubRelease[], request: ReleaseRequest): ReleaseVersion | null {
    return releases
      .filter(t => !t.isDraft && (!request.isSeparate || request.ownsTag(t.tag)))
      .map(t => request.parseTag(t.tag, Resources.formatReleaseTagLabel(t.id)))
      .reduce<ReleaseVersion | null>((found, t) => Object.isNull(found) || t.isNewerThan(found) ? t : found, null);
  }
}
