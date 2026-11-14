/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowsSignature } from "./i-windows-signature.js";

export interface IWindowsProcessApi {
  listProcesses(): readonly (readonly [number, number])[];
  openProcess(processId: number, access: number): bigint | number;
  readCreationTime(handle: bigint): bigint | null;
  readImagePath(handle: bigint): string | null;
  terminateProcess(handle: bigint): boolean;
  hasExited(handle: bigint): boolean;
  readExitCode(handle: bigint): number | null;
  openFileForReading(file: string): bigint | number;
  closeHandle(handle: bigint): void;
  createJob(holdsDescendants: boolean): bigint;
  assignProcessToJob(job: bigint, handle: bigint): number;
  listJobProcesses(job: bigint): readonly number[];
  verifySignatureAsync(file: string): Promise<IWindowsSignature>;
}
