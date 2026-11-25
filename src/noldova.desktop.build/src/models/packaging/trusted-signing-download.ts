/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TrustedSigningDownload {
  public readonly archive: string;
  public readonly destination: string;
  public readonly bytes: Buffer;

  public constructor(archive: string, destination: string, bytes: Buffer) {
    this.archive = archive;
    this.destination = destination;
    this.bytes = bytes;
  }
}
