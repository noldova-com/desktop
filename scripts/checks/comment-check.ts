/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import type { RepositoryFiles } from "../structure/repository-files.ts";
import type { ICommentReader } from "../structure/interfaces/i-comment.reader.ts";
import { MarkupCommentReader } from "../structure/markup-comment.reader.ts";
import { ScriptCommentReader } from "../structure/script-comment.reader.ts";
import { StyleCommentReader } from "../structure/style-comment.reader.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class CommentCheck implements ICheck {
  private static readonly READERS: ReadonlyMap<string, ICommentReader> = new Map([
    ...[...Resources.sourceScriptExtensions].map((t): [string, ICommentReader] => [t, new ScriptCommentReader()]),
    ...[...Resources.sourceStyleExtensions].map((t): [string, ICommentReader] => [t, new StyleCommentReader()]),
    [Resources.htmlExtension, new MarkupCommentReader()]
  ]);

  private readonly root: string;
  private readonly files: RepositoryFiles;

  public readonly title: string = Resources.commentCheckTitle;

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    let checked = 0;
    let failures = 0;
    for (const file of await this.files.listAsync()) {
      const reader = CommentCheck.READERS.get(path.posix.extname(file));
      if (Object.isUndefined(reader) || Resources.commentApiDeclarationsPattern.test(file))
        continue;
      checked++;
      for (const line of CommentCheck.readCommentLines(reader, await readFile(path.join(this.root, file), Resources.encoding))) {
        output.write(Resources.formatCommentFinding(file, line));
        failures++;
      }
    }
    output.write(Resources.formatCommentChecked(checked));
    return failures === 0;
  }

  private static readCommentLines(reader: ICommentReader, text: string): readonly number[] {
    const interpreterLines = Resources.interpreterLinePattern.test(text) ? 1 : 0;
    const body = text.replace(Resources.interpreterLinePattern, String.empty);
    if (!body.startsWith(reader.header))
      return reader.readCommentLines(body).map(t => t + interpreterLines);
    const headerLines = interpreterLines + reader.header.split(Resources.lineEnd).length - 1;
    return reader.readCommentLines(body.slice(reader.header.length)).map(t => t + headerLines);
  }
}
