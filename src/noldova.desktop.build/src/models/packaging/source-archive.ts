/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.ts";

export class SourceArchive {
  public readonly url: string;
  public readonly size: number;
  public readonly sha256: string;

  public constructor(url: string, size: number, sha256: string) {
    this.url = url;
    this.size = size;
    this.sha256 = sha256;
  }

  public get fileName(): string {
    return new URL(this.url).pathname.split(Resources.pathSegmentSeparator).at(-1) ?? String.empty;
  }

  public static parse(value: unknown): SourceArchive | null {
    if (!Object.isPlainObject(value))
      return null;
    const fields: Readonly<Record<string, unknown>> = Object.fromEntries(Object.entries(value));
    if (Object.keys(fields).length !== Resources.sourceArchiveFieldCount)
      return null;
    const url = fields[Resources.sourceArchiveUrlField];
    const size = fields[Resources.sourceArchiveSizeField];
    const sha256 = fields[Resources.sourceArchiveSha256Field];
    if (!Object.isString(url) || !Object.isNumber(size) || !Object.isString(sha256) || !Number.isSafeInteger(size) || size <= 0 || !Resources.sourceArchiveSha256Pattern.test(sha256)
      || !URL.canParse(url) || new URL(url).protocol !== Resources.secureProtocol || !Resources.sourceArchiveNamePattern.test(new SourceArchive(url, size, sha256).fileName))
      return null;
    return new SourceArchive(url, size, sha256);
  }

  public toJson(): Readonly<Record<string, string | number>> {
    return { [Resources.sourceArchiveUrlField]: this.url, [Resources.sourceArchiveSizeField]: this.size, [Resources.sourceArchiveSha256Field]: this.sha256 };
  }

  public isSame(other: SourceArchive): boolean {
    return this.url === other.url && this.size === other.size && this.sha256 === other.sha256;
  }
}
