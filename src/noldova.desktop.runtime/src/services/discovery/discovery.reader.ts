/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { DiscoveryUnreadableException } from "../../exceptions/discovery-unreadable.exception.js";
import { RuntimeDiscovery } from "../../models/runtime-discovery.js";
import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";
import type { DataDirectory } from "../data-directory/data-directory.js";

export class DiscoveryReader {
  public static async readAsync(dataDirectory: DataDirectory, platform: string = process.platform): Promise<RuntimeDiscovery | null> {
    const file = dataDirectory.discoveryFile;
    const text = await DiscoveryReader.readTextAsync(file, platform === Resources.windowsPlatform);
    if (Object.isNull(text))
      return null;
    try {
      return RuntimeDiscovery.fromJson(JsonReader.parse(text).toJson());
    }
    catch (error) {
      throw new DiscoveryUnreadableException(file, error);
    }
  }

  private static async readTextAsync(file: string, isWindows: boolean): Promise<string | null> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await readFile(file, Resources.utf8Encoding);
      }
      catch (error) {
        if (SystemErrorCode.is(error, Resources.missingFileCode))
          return null;
        if (!isWindows || attempt >= Resources.discoveryReadAttempts || !SystemErrorCode.isAny(error, Resources.busyFileErrorCodes))
          throw error;
      }
      await delay(Resources.discoveryReadRetryDelay);
    }
  }
}
