/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ICommentReader } from "./interfaces/i-comment.reader.ts";
import { LicenseHeaderNotice } from "./license-header-notice.ts";
import { Resources } from "../resources.ts";

export class MarkupCommentReader implements ICommentReader {
  public readonly header: string = LicenseHeaderNotice.MARKUP;

  public readCommentLines(text: string): readonly number[] {
    const lines: number[] = [];
    for (let start = text.indexOf(Resources.markupCommentStart); start >= 0; start = text.indexOf(Resources.markupCommentStart, start + 1))
      lines.push(text.slice(0, start).split(Resources.lineEnd).length);
    return lines;
  }
}
