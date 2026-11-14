/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPosixProcessApi } from "@noldova/desktop.runtime";

export class PosixProcessApiFixture implements IPosixProcessApi {
  private readonly result: number | Error;

  public readonly calls: (readonly [string, readonly string[], readonly string[], number, string | undefined, number | undefined, number | undefined, string | undefined])[] = [];

  public constructor(result: number | Error) {
    this.result = result;
  }

  public startDetached(file: string, launchArguments: readonly string[], environment: readonly string[], errorDescriptor: number, workingFolder?: string, outputDescriptor?: number,
    inputDescriptor?: number, disclaimFunction?: string): number {
    this.calls.push([file, [...launchArguments], [...environment], errorDescriptor, workingFolder, outputDescriptor, inputDescriptor, disclaimFunction]);
    if (this.result instanceof Error)
      throw this.result;
    return this.result;
  }
}
