/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IWindowsProcessAddon } from "../../interfaces/i-windows-process-addon.js";
import type { IWindowsProcessApi } from "../../interfaces/i-windows-process-api.js";
import type { IWindowsSignature } from "../../interfaces/i-windows-signature.js";
import { Resources } from "../../resources.js";
import { NativeAddon } from "../native/native-addon.js";

export class WindowsProcessApi implements IWindowsProcessApi {
  private readonly addon: NativeAddon<IWindowsProcessAddon>;

  public constructor(file: string) {
    this.addon = new NativeAddon<IWindowsProcessAddon>(file, Resources.windowsAddonFunctions);
  }

  public static create(): WindowsProcessApi {
    return new WindowsProcessApi(NativeAddon.locate(Resources.windowsAddonFile));
  }

  private static isHandleOrError(value: unknown): value is bigint | number {
    return Object.isBigInt(value) || Object.isNumber(value);
  }

  private static isSignature(value: unknown): value is IWindowsSignature {
    if (!Object.isObject(value) || !(Resources.signatureStatusField in value) || !(Resources.signatureMessageField in value) || !(Resources.signatureSubjectField in value))
      return false;
    const subject = value[Resources.signatureSubjectField];
    return Object.isNumber(value[Resources.signatureStatusField]) && Object.isString(value[Resources.signatureMessageField]) && (Object.isString(subject) || Object.isNull(subject));
  }

  public listProcesses(): readonly (readonly [number, number])[] {
    return this.addon.expect(this.addon.load().listProcesses(), (t): t is readonly (readonly [number, number])[] => Array.isArray(t)
      && t.every(row => Array.isArray(row) && row.length === Resources.windowsProcessRowLength && row.every(id => Object.isNumber(id))));
  }

  public openProcess(processId: number, access: number): bigint | number {
    return this.addon.expect(this.addon.load().openProcess(processId, access), WindowsProcessApi.isHandleOrError);
  }

  public readCreationTime(handle: bigint): bigint | null {
    return this.addon.expect(this.addon.load().readCreationTime(handle), (t): t is bigint | null => Object.isBigInt(t) || Object.isNull(t));
  }

  public readImagePath(handle: bigint): string | null {
    return this.addon.expect(this.addon.load().readImagePath(handle), (t): t is string | null => Object.isString(t) || Object.isNull(t));
  }

  public terminateProcess(handle: bigint): boolean {
    return this.addon.expect(this.addon.load().terminateProcess(handle), Object.isBoolean);
  }

  public hasExited(handle: bigint): boolean {
    return this.addon.expect(this.addon.load().hasExited(handle), Object.isBoolean);
  }

  public readExitCode(handle: bigint): number | null {
    return this.addon.expect(this.addon.load().readExitCode(handle), (t): t is number | null => (Object.isNumber(t) && Number.isInteger(t)) || Object.isNull(t));
  }

  public openFileForReading(file: string): bigint | number {
    return this.addon.expect(this.addon.load().openFileForReading(file), WindowsProcessApi.isHandleOrError);
  }

  public closeHandle(handle: bigint): void {
    this.addon.expect(this.addon.load().closeHandle(handle), Object.isUndefined);
  }

  public createJob(holdsDescendants: boolean): bigint {
    return this.addon.expect(this.addon.load().createJob(holdsDescendants), Object.isBigInt);
  }

  public assignProcessToJob(job: bigint, handle: bigint): number {
    return this.addon.expect(this.addon.load().assignProcessToJob(job, handle), (t): t is number => Object.isNumber(t) && Number.isInteger(t) && t >= 0);
  }

  public listJobProcesses(job: bigint): readonly number[] {
    return this.addon.expect(this.addon.load().listJobProcesses(job),
      (t): t is readonly number[] => Array.isArray(t) && t.every(u => Object.isNumber(u) && Number.isInteger(u) && u > 0));
  }

  public async verifySignatureAsync(file: string): Promise<IWindowsSignature> {
    return this.addon.expect(await this.addon.load().verifySignatureAsync(file), WindowsProcessApi.isSignature);
  }
}
