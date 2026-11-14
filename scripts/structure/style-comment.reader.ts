/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ICommentReader } from "./interfaces/i-comment.reader.ts";
import { Resources as BuildResources } from "../../src/noldova.desktop.build/src/resources.ts";
import { Resources } from "../resources.ts";

export class StyleCommentReader implements ICommentReader {
  public readonly header: string = BuildResources.licenseHeaderBlock;

  public readCommentLines(text: string): readonly number[] {
    const lines: number[] = [];
    let line = 1;
    let position = 0;
    while (position < text.length) {
      const character = text.charAt(position);
      let next = position + 1;
      if (text.startsWith(Resources.styleBlockCommentStart, position)) {
        lines.push(line);
        next = StyleCommentReader.findEnd(text, Resources.styleBlockCommentEnd, position + Resources.styleBlockCommentStart.length) + Resources.styleBlockCommentEnd.length;
      } else if (text.startsWith(Resources.styleLineCommentStart, position)) {
        lines.push(line);
        next = StyleCommentReader.findEnd(text, Resources.lineEnd, position);
      } else if (text.startsWith(Resources.styleUrlStart, position))
        next = StyleCommentReader.findEnd(text, Resources.styleUrlEnd, position) + Resources.styleUrlEnd.length;
      else if (Resources.styleQuotes.has(character))
        next = StyleCommentReader.findStringEnd(text, position);
      line += text.slice(position, next).split(Resources.lineEnd).length - 1;
      position = next;
    }
    return lines;
  }

  private static findEnd(text: string, marker: string, start: number): number {
    const end = text.indexOf(marker, start);
    return end < 0 ? text.length : end;
  }

  private static findStringEnd(text: string, start: number): number {
    const quote = text.charAt(start);
    let position = start + 1;
    while (position < text.length && text.charAt(position) !== quote && text.charAt(position) !== Resources.lineEnd)
      position += text.charAt(position) === Resources.styleEscapeCharacter ? 2 : 1;
    return position + 1;
  }
}
