/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";

export class ProcessTranscript {
  private readonly chunks: Buffer[] = [];

  public add(chunk: Buffer): void {
    this.chunks.push(chunk);
  }

  public get text(): string {
    return Buffer.concat(this.chunks).toString(Resources.textEncoding);
  }
}
