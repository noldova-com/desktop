/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";

import { DeviceIdentityException } from "../exceptions/device-identity.exception.js";
import { Resources } from "../resources.js";
import { FilePresence } from "./file-presence.js";

export class DeviceIdentity {
  public static async readOrCreateAsync(folder: string): Promise<string> {
    const file = path.join(folder, Resources.deviceFileName);
    if (!await FilePresence.existsAsync(file)) {
      await mkdir(folder, { recursive: true });
      const draft = Resources.formatDraftFile(file, randomUUID());
      await writeFile(draft, Resources.formatJsonLine(JSON.stringify({ [Resources.deviceIdField]: randomUUID() })), { flag: Resources.createOnlyFlag });
      await link(draft, file).catch(() => undefined);
      await rm(draft, { force: true });
    }
    let id: string;
    try {
      id = JsonReader.parse(await readFile(file, Resources.textEncoding)).readString(Resources.deviceIdField);
    }
    catch (error) {
      throw new DeviceIdentityException(file, new ExceptionOptions(error));
    }
    if (!Resources.uuidPattern.test(id))
      throw new DeviceIdentityException(file);
    return id;
  }
}
