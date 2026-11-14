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
import { Resources } from "../../resources.js";
import { NativeAddon } from "../native/native-addon.js";

export class PosixResponsibilityApi {
  private readonly addon: NativeAddon<IPosixProcessAddon>;

  public constructor(addon: NativeAddon<IPosixProcessAddon>) {
    this.addon = addon;
  }

  public static create(platform: string = process.platform): PosixResponsibilityApi | null {
    if (platform !== Resources.macPlatform)
      return null;
    return new PosixResponsibilityApi(new NativeAddon<IPosixProcessAddon>(NativeAddon.locate(Resources.posixAddonFile), [Resources.readResponsibleProcessIdFunction]));
  }

  private static isProcessId(value: unknown): value is number | null {
    return Object.isNull(value) || (Object.isNumber(value) && Number.isInteger(value) && value > 0);
  }

  public findResponsible(processId: number, systemFunction: string = Resources.responsibleSystemFunction): number | null {
    const addon = this.addon.load();
    if (Object.isUndefined(addon.readResponsibleProcessId))
      throw new AddonIncompleteException(this.addon.name);
    return this.addon.expect(addon.readResponsibleProcessId(processId, systemFunction), PosixResponsibilityApi.isProcessId);
  }

  public describe(processId: number): string | null {
    const responsible = this.findResponsible(processId);
    if (Object.isNull(responsible))
      return Resources.responsibilityUnreadable;
    return responsible === processId ? null : Resources.responsibilityInherited;
  }
}
