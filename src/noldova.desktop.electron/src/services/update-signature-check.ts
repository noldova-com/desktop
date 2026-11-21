/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createPublicKey, verify } from "node:crypto";
import { basename } from "node:path";

import type { UpdateInfo } from "electron-updater";

import "@noldova/context.core";

import { Resources } from "../resources.js";
import { UpdateController } from "./update-controller.js";

export class UpdateSignatureCheck {
  private readonly keys: readonly string[];
  private readonly target: string;
  private readonly log: (text: string) => void;
  private readonly now: () => number;

  public constructor(keys: readonly string[], platform: string, architecture: string, log: (text: string) => void, now: () => number) {
    this.keys = keys;
    this.target = Resources.formatUpdateTarget(platform, architecture);
    this.log = log;
    this.now = now;
  }

  public async checkAsync(file: string, info: UpdateInfo | null): Promise<string | null> {
    const started = this.now();
    let failure: string | null;
    try {
      failure = await this.verifyAsync(file, info);
    }
    catch (error) {
      failure = Resources.formatUpdateSignatureUnchecked(String(error));
    }
    this.log(Resources.formatUpdateSignatureCheck(this.now() - started, Object.isNull(failure)));
    return failure;
  }

  private async verifyAsync(file: string, info: UpdateInfo | null): Promise<string | null> {
    if (this.keys.length === 0)
      return Resources.updateKeysUnknown;
    const name = basename(file);
    const entry = info?.files.find(t => t.url === name);
    if (Object.isNull(info) || Object.isUndefined(entry))
      return Resources.updateEntryMissing;
    const signature: unknown = Reflect.get(entry, Resources.updateSignatureField);
    if (!Object.isString(signature) || signature.length === 0)
      return Resources.updateSignatureMissing;
    const sha512 = await UpdateController.hashFileAsync(file);
    if (sha512 !== entry.sha512)
      return Resources.updateHashDiffers;
    const message = Buffer.from(Resources.formatUpdateSignatureMessage(info.version, this.target, name, sha512), Resources.textEncoding);
    const bytes = Buffer.from(signature, Resources.base64Encoding);
    const isSigned = bytes.length === Resources.updateSignatureLength && bytes.toString(Resources.base64Encoding) === signature
      && this.keys.some(t => verify(null, message, createPublicKey({ key: Buffer.from(t, Resources.base64Encoding), type: Resources.publicKeyEncoding, format: Resources.keyDerFormat }), bytes));
    return isSigned ? null : Resources.updateSignatureInvalid;
  }
}
