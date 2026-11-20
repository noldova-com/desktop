/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWindowsProcessApi, IWindowsSignature } from "@noldova/desktop.runtime";

export class WindowsProcessApiFixture implements IWindowsProcessApi {
  public static readonly QUERY: number = 0x1000;
  public static readonly END: number = 0x1000 | 0x0001 | 0x100000;
  public static readonly JOB: number = 0x1000 | 0x0100 | 0x0001 | 0x100000;
  public static readonly GONE: number = 87;
  public static readonly DENIED: number = 5;
  private static readonly EPOCH: number = 11_644_473_600_000;

  private readonly tables: (string | Error | (() => string))[];
  private readonly starts: Map<number, number> = new Map();
  private readonly paths: Map<number, string | null> = new Map();
  private readonly handles: Map<bigint, readonly [number, number]> = new Map();
  private readonly jobs: Map<bigint, number[]> = new Map();
  private nextHandle: bigint = 1n;

  public readonly opened: string[] = [];
  public readonly denied: Map<number, number> = new Map();
  public readonly unreadable: Map<number, number> = new Map();
  public readonly replaced: Map<number, number> = new Map();
  public readonly exitCodes: Map<number, number> = new Map();
  public readonly unseenExits: Map<number, number> = new Map();
  public readonly createdJobs: boolean[] = [];
  public listings: number = 0;
  public exitChecks: number = 0;
  public assignmentError: number = 0;
  public held: readonly number[] = [];
  public readonly jobListings: number[] = [];
  public onAssign: () => void = () => undefined;
  public rest: () => string = () => String.empty;

  public constructor(tables: readonly (string | Error | (() => string))[] = []) {
    this.tables = [...tables];
  }

  public get openHandles(): number {
    return this.handles.size;
  }

  public static toFileTime(milliseconds: number): bigint {
    return BigInt(milliseconds + WindowsProcessApiFixture.EPOCH) * 10_000n;
  }

  public listProcesses(): readonly (readonly [number, number])[] {
    this.listings++;
    const table = this.tables.shift() ?? this.rest;
    if (table instanceof Error)
      throw table;
    const rows = (Object.isFunction(table) ? table() : table).split("\n").filter(t => t !== String.empty).map(t => t.split("\t"));
    for (const [processId, , started, executable] of rows) {
      this.starts.set(Number(processId), Number(started));
      this.paths.set(Number(processId), executable === String.empty || Object.isUndefined(executable) ? null : executable);
    }
    return rows.map(([processId, parentId]) => [Number(processId), Number(parentId)] as const);
  }

  public openProcess(processId: number, access: number): bigint | number {
    this.opened.push(`${processId} ${access}`);
    if (this.denied.get(processId) === access)
      return WindowsProcessApiFixture.DENIED;
    if (access === WindowsProcessApiFixture.QUERY ? !this.starts.has(processId) : access !== WindowsProcessApiFixture.JOB && !WindowsProcessApiFixture.isRunning(processId))
      return WindowsProcessApiFixture.GONE;
    const handle = this.nextHandle++;
    this.handles.set(handle, [processId, access]);
    return handle;
  }

  public readCreationTime(handle: bigint): bigint | null {
    const [processId, access] = this.open(handle);
    const started = this.starts.get(processId);
    if (this.unreadable.get(processId) === access || Object.isUndefined(started))
      return null;
    return WindowsProcessApiFixture.toFileTime(this.replaced.get(processId) === access ? started + 3_600_000 : started);
  }

  public readImagePath(handle: bigint): string | null {
    return this.paths.get(this.find(handle)) ?? null;
  }

  public terminateProcess(handle: bigint): boolean {
    try {
      return process.kill(this.find(handle), "SIGKILL");
    }
    catch {
      return false;
    }
  }

  public hasExited(handle: bigint): boolean {
    this.exitChecks++;
    const processId = this.find(handle);
    const unseen = this.unseenExits.get(processId) ?? 0;
    if (unseen > 0) {
      this.unseenExits.set(processId, unseen - 1);
      return false;
    }
    return !WindowsProcessApiFixture.isRunning(processId);
  }

  public readExitCode(handle: bigint): number | null {
    return this.exitCodes.get(this.find(handle)) ?? null;
  }

  public openFileForReading(file: string): bigint | number {
    this.opened.push(file);
    const handle = this.nextHandle++;
    this.handles.set(handle, [0, 0]);
    return handle;
  }

  public closeHandle(handle: bigint): void {
    this.find(handle);
    this.handles.delete(handle);
    this.jobs.delete(handle);
  }

  public createJob(holdsDescendants: boolean): bigint {
    this.createdJobs.push(holdsDescendants);
    const handle = this.nextHandle++;
    this.handles.set(handle, [0, 0]);
    this.jobs.set(handle, []);
    return handle;
  }

  public assignProcessToJob(job: bigint, handle: bigint): number {
    this.onAssign();
    const processId = this.find(handle);
    if (this.assignmentError !== 0)
      return this.assignmentError;
    if (!WindowsProcessApiFixture.isRunning(processId))
      return WindowsProcessApiFixture.DENIED;
    this.jobs.get(job)?.push(processId);
    return 0;
  }

  public listJobProcesses(job: bigint): readonly number[] {
    this.jobListings.push(this.listings);
    return [...this.jobs.get(job) ?? [], ...this.held].filter(t => WindowsProcessApiFixture.isRunning(t));
  }

  public verifySignatureAsync(): Promise<IWindowsSignature> {
    return Promise.reject(new Error("The process fixture reads no signatures."));
  }

  private static isRunning(processId: number): boolean {
    try {
      return process.kill(processId, 0);
    }
    catch {
      return false;
    }
  }

  private find(handle: bigint): number {
    return this.open(handle)[0];
  }

  private open(handle: bigint): readonly [number, number] {
    const opened = this.handles.get(handle);
    if (Object.isUndefined(opened))
      throw new Error(`The handle ${handle} is not open.`);
    return opened;
  }
}
