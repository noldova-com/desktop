/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.ts";

export class SourceFile {
  public readonly url: string;
  public readonly size: number;
  public readonly sha256: string;

  public constructor(url: string, size: number, sha256: string) {
    this.url = url;
    this.size = size;
    this.sha256 = sha256;
  }

  public static parse(value: unknown): SourceFile | null {
    if (!Object.isPlainObject(value))
      return null;
    const fields: Readonly<Record<string, unknown>> = Object.fromEntries(Object.entries(value));
    if (Object.keys(fields).length !== Resources.sourceFileFieldCount)
      return null;
    const url = fields[Resources.sourceFileUrlField];
    const size = fields[Resources.sourceFileSizeField];
    const sha256 = fields[Resources.sourceFileSha256Field];
    if (!SourceFile.isAddress(url) || !Object.isNumber(size) || !Object.isString(sha256) || !Number.isSafeInteger(size) || size <= 0
      || !Resources.sourceFileSha256Pattern.test(sha256))
      return null;
    return new SourceFile(url, size, sha256);
  }

  public static isAddress(value: unknown): value is string {
    return Object.isString(value) && URL.canParse(value) && new URL(value).protocol === Resources.secureProtocol;
  }
}
