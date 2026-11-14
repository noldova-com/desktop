/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IPosixProcessApi {
  startDetached(file: string, launchArguments: readonly string[], environment: readonly string[], errorDescriptor: number, workingFolder?: string, outputDescriptor?: number,
    inputDescriptor?: number, disclaimFunction?: string): number;
}
