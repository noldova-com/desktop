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

import type { UpdateReadyRecord } from "../models/update-ready-record.js";
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

  public static readSignature(info: UpdateInfo | null, file: string): string | null {
    const name = basename(file);
    const entry = info?.files.find(t => t.url === name);
    if (Object.isUndefined(entry))
      return null;
    const signature: unknown = Reflect.get(entry, Resources.updateSignatureField);
    return Object.isString(signature) && signature.length > 0 ? signature : null;
  }

  public checkAsync(file: string, info: UpdateInfo | null): Promise<string | null> {
    return this.timeAsync(() => this.verifyAsync(file, info));
  }

  public checkReadyAsync(record: UpdateReadyRecord): Promise<string | null> {
    return this.timeAsync(() => this.verifyReadyAsync(record));
  }

  private async timeAsync(check: () => Promise<string | null>): Promise<string | null> {
    const started = this.now();
    let failure: string | null;
    try {
      failure = await check();
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
    const signature = UpdateSignatureCheck.readSignature(info, file);
    if (Object.isNull(signature))
      return Resources.updateSignatureMissing;
    const sha512 = await UpdateController.hashFileAsync(file);
    if (sha512 !== entry.sha512)
      return Resources.updateHashDiffers;
    return this.isSigned(info.version, name, sha512, signature) ? null : Resources.updateSignatureInvalid;
  }

  private async verifyReadyAsync(record: UpdateReadyRecord): Promise<string | null> {
    if (this.keys.length === 0)
      return Resources.updateKeysUnknown;
    if (Object.isNull(record.signature))
      return Resources.updateReadySignatureMissing;
    const sha512 = await UpdateController.hashFileAsync(record.file);
    return this.isSigned(record.version, basename(record.file), sha512, record.signature) ? null : Resources.updateSignatureInvalid;
  }

  private isSigned(version: string, name: string, sha512: string, signature: string): boolean {
    const message = Buffer.from(Resources.formatUpdateSignatureMessage(version, this.target, name, sha512), Resources.textEncoding);
    const bytes = Buffer.from(signature, Resources.base64Encoding);
    return bytes.length === Resources.updateSignatureLength && bytes.toString(Resources.base64Encoding) === signature
      && this.keys.some(t => verify(null, message, createPublicKey({ key: Buffer.from(t, Resources.base64Encoding), type: Resources.publicKeyEncoding, format: Resources.keyDerFormat }), bytes));
  }
}
