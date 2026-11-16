/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IPosixProcessAddon {
  startDetached?(file: string, launchArguments: readonly string[], environment: readonly string[], errorDescriptor: number, ...options: (string | number | undefined)[]): unknown;
  clockTicks?(): unknown;
  peerProcessId?(descriptor: number): unknown;
  listProcesses?(): unknown;
  peerToken?(descriptor: number): unknown;
  readProcessPath?(processId: number): unknown;
  readResponsibleProcessId?(processId: number, systemFunction: string): unknown;
  readEnvironment?(processId: number): unknown;
  readVolume?(folder: string): unknown;
}
