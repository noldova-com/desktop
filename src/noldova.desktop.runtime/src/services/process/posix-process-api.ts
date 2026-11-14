/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { AddonIncompleteException } from "../../exceptions/addon-incomplete.exception.js";
import type { IPosixProcessAddon } from "../../interfaces/i-posix-process-addon.js";
import type { IPosixProcessApi } from "../../interfaces/i-posix-process-api.js";
import type { IPosixProcessTableApi } from "../../interfaces/i-posix-process-table-api.js";
import { Resources } from "../../resources.js";
import { NativeAddon } from "../native/native-addon.js";
import { LinuxProcessFolder } from "./linux-process-folder.js";

export class PosixProcessApi implements IPosixProcessApi, IPosixProcessTableApi {
  private readonly addon: NativeAddon<IPosixProcessAddon>;
  private readonly platform: string;
  private readonly processFolder: string;

  public constructor(addon: NativeAddon<IPosixProcessAddon>, platform: string = process.platform, processFolder: string = Resources.processFolder) {
    this.addon = addon;
    this.platform = platform;
    this.processFolder = processFolder;
  }

  public static create(platform: string = process.platform): PosixProcessApi {
    const table = platform === Resources.linuxPlatform ? Resources.clockTicksFunction : Resources.listProcessesFunction;
    return new PosixProcessApi(new NativeAddon<IPosixProcessAddon>(NativeAddon.locate(Resources.posixAddonFile), [Resources.startDetachedFunction, table]), platform);
  }

  public startDetached(file: string, launchArguments: readonly string[], environment: readonly string[], errorDescriptor: number, workingFolder?: string, outputDescriptor?: number,
    inputDescriptor?: number, disclaimFunction?: string): number {
    const options = [workingFolder, outputDescriptor, inputDescriptor, disclaimFunction];
    const given = options.slice(0, options.findLastIndex(t => !Object.isUndefined(t)) + 1);
    const addon = this.addon.load();
    if (Object.isUndefined(addon.startDetached))
      throw new AddonIncompleteException(this.addon.name);
    return this.addon.expect(addon.startDetached(file, launchArguments, environment, errorDescriptor, ...given), (t): t is number => Object.isNumber(t) && Number.isInteger(t) && t > 0);
  }

  public async listProcessesAsync(): Promise<readonly (readonly [number, number, number, number, number, number?])[]> {
    const addon = this.addon.load();
    if (this.platform !== Resources.linuxPlatform) {
      if (Object.isUndefined(addon.listProcesses))
        throw new AddonIncompleteException(this.addon.name);
      return this.addon.expect(addon.listProcesses(), PosixProcessApi.isTable);
    }
    if (Object.isUndefined(addon.clockTicks))
      throw new AddonIncompleteException(this.addon.name);
    const ticks = this.addon.expect(addon.clockTicks(), (t): t is number => Object.isNumber(t) && Number.isInteger(t) && t > 0);
    return await new LinuxProcessFolder(this.processFolder, ticks).readAsync();
  }

  private static isTable(value: unknown): value is readonly (readonly [number, number, number, number, number, number?])[] {
    return Array.isArray(value) && value.every(t => Array.isArray(t) && t.length === Resources.processRowLength && t.every(u => Object.isNumber(u) && Number.isFinite(u)));
  }
}
