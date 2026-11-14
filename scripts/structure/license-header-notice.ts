/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources as BuildResources } from "../../src/noldova.desktop.build/src/resources.ts";
import { Resources } from "../resources.ts";

export class LicenseHeaderNotice {
  private static readonly NOTICE: readonly string[] = BuildResources.licenseHeaderBlock.split(Resources.lineEnd).slice(1, -2)
    .map(t => LicenseHeaderNotice.unindent(t.slice(Resources.licenseNoticeBlockLinePrefix.length)));

  public static readonly MARKUP: string = [Resources.markupCommentStart, ...LicenseHeaderNotice.NOTICE, Resources.markupCommentEnd, String.empty].join(Resources.lineEnd);
  public static readonly YAML: string = [...LicenseHeaderNotice.NOTICE.map(t => Resources.formatLicenseNoticeYamlLine(t)), String.empty].join(Resources.lineEnd);

  private static unindent(line: string): string {
    return line === String.empty ? String.empty : line.slice(1);
  }
}
