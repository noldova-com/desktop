/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IWindowsProcessAddon {
  listProcesses(): unknown;
  openProcess(processId: number, access: number): unknown;
  readCreationTime(handle: bigint): unknown;
  readImagePath(handle: bigint): unknown;
  terminateProcess(handle: bigint): unknown;
  hasExited(handle: bigint): unknown;
  readExitCode(handle: bigint): unknown;
  openFileForReading(file: string): unknown;
  closeHandle(handle: bigint): unknown;
  createJob(holdsDescendants: boolean): unknown;
  assignProcessToJob(job: bigint, handle: bigint): unknown;
  listJobProcesses(job: bigint): unknown;
  verifySignatureAsync(file: string): unknown;
}
