/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class OnceHash {
  private readonly read: () => Promise<string>;
  private hash: Promise<string> | null = null;

  public constructor(read: () => Promise<string>) {
    this.read = read;
  }

  public readAsync(): Promise<string> {
    this.hash ??= this.read().catch((error: unknown) => {
      this.hash = null;
      throw error;
    });
    return this.hash;
  }
}
