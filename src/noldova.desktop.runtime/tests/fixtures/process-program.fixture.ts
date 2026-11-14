/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type IPosixProcessAddon, NativeAddon } from "@noldova/desktop.runtime";

export class ProcessProgramFixture {
  private static readonly FUNCTION: keyof IPosixProcessAddon = "readProcessPath";
  private static readonly ADDON_FILE: string = "posix-process.node";

  private readonly addon: NativeAddon<IPosixProcessAddon>;

  public constructor(addon: NativeAddon<IPosixProcessAddon>) {
    this.addon = addon;
  }

  public static create(): ProcessProgramFixture {
    return new ProcessProgramFixture(new NativeAddon<IPosixProcessAddon>(NativeAddon.locate(ProcessProgramFixture.ADDON_FILE), [ProcessProgramFixture.FUNCTION]));
  }

  public read(processId: number): string | null {
    return this.addon.expect(this.addon.load().readProcessPath?.(processId), (t): t is string | null => Object.isString(t) || Object.isNull(t));
  }
}
