/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ICommentReader } from "./interfaces/i-comment.reader.ts";
import { Resources as BuildResources } from "../../src/noldova.desktop.build/src/resources.ts";
import { SourceScanner } from "../../src/noldova.desktop.build/src/services/structure/source-scanner.ts";

export class ScriptCommentReader implements ICommentReader {
  public readonly header: string = BuildResources.licenseHeaderBlock;

  public readCommentLines(text: string): readonly number[] {
    return new SourceScanner(text).scan().comments;
  }
}
