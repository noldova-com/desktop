/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rm } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";

import "@noldova/context.core";

export class GrantedFile implements AsyncDisposable {
  private readonly staged: string | null;
  private closing: Promise<void> | null = null;

  public readonly name: string;
  public readonly mediaType: string;
  public readonly size: number;
  public readonly handle: FileHandle;

  public constructor(name: string, mediaType: string, size: number, handle: FileHandle, staged: string | null = null) {
    this.name = name;
    this.mediaType = mediaType;
    this.size = size;
    this.handle = handle;
    this.staged = staged;
  }

  public closeAsync(): Promise<void> {
    this.closing ??= this.endAsync();
    return this.closing;
  }

  public [Symbol.asyncDispose](): Promise<void> {
    return this.closeAsync();
  }

  private async endAsync(): Promise<void> {
    try {
      await this.handle.close();
    }
    finally {
      if (!Object.isNull(this.staged))
        await rm(this.staged, { force: true });
    }
  }
}
