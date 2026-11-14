/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { closeSync, constants, fstatSync, openSync, readdirSync, readlinkSync } from "node:fs";
import path from "node:path";

import "@noldova/context.core";

import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";

export class AppImageKeepalive {
  public static open(processId: number): number | null {
    const folder = path.posix.join(Resources.processFolder, String(processId), Resources.descriptorFolderName);
    const names = AppImageKeepalive.unlessGone(() => readdirSync(folder)) ?? [];
    const pipes = names.map(t => ({ name: t, link: AppImageKeepalive.readLink(path.posix.join(folder, t)) })).filter(t => t.link.startsWith(Resources.pipeLinkPrefix));
    const [pipe, ...others] = pipes;
    if (Object.isUndefined(pipe) || others.length > 0)
      return null;
    const descriptor = AppImageKeepalive.unlessGone(() => openSync(path.posix.join(folder, pipe.name), constants.O_RDONLY | constants.O_NONBLOCK));
    if (Object.isNull(descriptor) || AppImageKeepalive.isPipe(descriptor, pipe.link))
      return descriptor;
    closeSync(descriptor);
    return null;
  }

  public static findWriters(file: string): readonly number[] {
    return readdirSync(Resources.processFolder).filter(t => Resources.processIdPattern.test(t))
      .filter(t => AppImageKeepalive.readLink(path.posix.join(Resources.processFolder, t, Resources.descriptorFolderName, Resources.outputDescriptorName)) === file)
      .map(Number);
  }

  private static isPipe(descriptor: number, link: string): boolean {
    try {
      const status = fstatSync(descriptor);
      return status.isFIFO() && Resources.formatPipeLink(status.ino) === link;
    }
    catch (error) {
      closeSync(descriptor);
      throw error;
    }
  }

  private static unlessGone<T>(read: () => T): T | null {
    try {
      return read();
    }
    catch (error) {
      if (error instanceof Error && Resources.nodeErrorCodeField in error && error[Resources.nodeErrorCodeField] === Resources.missingFileCode)
        return null;
      throw error;
    }
  }

  private static readLink(file: string): string {
    try {
      return readlinkSync(file);
    }
    catch (error) {
      if (!SystemErrorCode.isAny(error, Resources.unreadableDescriptorCodes))
        throw error;
      return String.empty;
    }
  }
}
