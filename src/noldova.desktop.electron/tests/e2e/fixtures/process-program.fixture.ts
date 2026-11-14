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
  private static readonly ADDON_FILE: string = "posix-process.node";
  private static readonly FUNCTION: keyof IPosixProcessAddon = "readProcessPath";

  public static read(processId: number): string | null {
    const addon = new NativeAddon<IPosixProcessAddon>(NativeAddon.locate(ProcessProgramFixture.ADDON_FILE), [ProcessProgramFixture.FUNCTION]);
    return addon.expect(addon.load().readProcessPath?.(processId), (t): t is string | null => Object.isString(t) || Object.isNull(t));
  }
}
