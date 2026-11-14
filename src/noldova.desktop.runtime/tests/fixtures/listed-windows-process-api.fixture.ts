/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowsProcessApi, IWindowsSignature } from "@noldova/desktop.runtime";

export class ListedWindowsProcessApiFixture implements IWindowsProcessApi {
  private readonly api: IWindowsProcessApi;
  private readonly processIds: readonly number[];

  public constructor(api: IWindowsProcessApi, processIds: readonly number[]) {
    this.api = api;
    this.processIds = [...processIds];
  }

  public listProcesses(): readonly (readonly [number, number])[] {
    return this.api.listProcesses().filter(([processId]) => this.processIds.includes(processId));
  }

  public openProcess(processId: number, access: number): bigint | number {
    return this.api.openProcess(processId, access);
  }

  public readCreationTime(handle: bigint): bigint | null {
    return this.api.readCreationTime(handle);
  }

  public readImagePath(handle: bigint): string | null {
    return this.api.readImagePath(handle);
  }

  public terminateProcess(handle: bigint): boolean {
    return this.api.terminateProcess(handle);
  }

  public hasExited(handle: bigint): boolean {
    return this.api.hasExited(handle);
  }

  public readExitCode(handle: bigint): number | null {
    return this.api.readExitCode(handle);
  }

  public openFileForReading(file: string): bigint | number {
    return this.api.openFileForReading(file);
  }

  public closeHandle(handle: bigint): void {
    this.api.closeHandle(handle);
  }

  public createJob(holdsDescendants: boolean): bigint {
    return this.api.createJob(holdsDescendants);
  }

  public assignProcessToJob(job: bigint, handle: bigint): number {
    return this.api.assignProcessToJob(job, handle);
  }

  public listJobProcesses(job: bigint): readonly number[] {
    return this.api.listJobProcesses(job);
  }

  public verifySignatureAsync(file: string): Promise<IWindowsSignature> {
    return this.api.verifySignatureAsync(file);
  }
}
