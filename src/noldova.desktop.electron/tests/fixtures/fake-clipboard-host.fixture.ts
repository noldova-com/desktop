/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IClipboardHost } from "@noldova/desktop.electron";

export class FakeClipboardHost implements IClipboardHost {
  public readonly texts: string[] = [];
  public readonly images: Uint8Array[] = [];
  public decodes: boolean = true;
  public imageFailure: Error | null = null;
  public imageHold: Promise<void> = Promise.resolve();

  public writeText(text: string): void {
    this.texts.push(text);
  }

  public async writeImageAsync(bytes: Uint8Array): Promise<boolean> {
    await this.imageHold;
    if (!Object.isNull(this.imageFailure))
      throw this.imageFailure;
    if (!this.decodes)
      return false;
    this.images.push(bytes);
    return true;
  }
}
