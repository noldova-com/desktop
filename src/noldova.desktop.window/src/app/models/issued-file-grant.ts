/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class IssuedFileGrant {
  public readonly grant: string;
  public readonly name: string;
  public readonly mediaType: string;
  public readonly size: number;

  public constructor(grant: string, name: string, mediaType: string, size: number) {
    this.grant = grant;
    this.name = name;
    this.mediaType = mediaType;
    this.size = size;
  }
}
