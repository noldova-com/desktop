/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createPrivateKey, createPublicKey, type KeyObject, sign, verify } from "node:crypto";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class UpdateSignature {
  public static formatMessage(version: string, targetId: string, name: string, sha512: string): Buffer {
    return Buffer.from(Resources.formatUpdateSignatureMessage(version, targetId, name, sha512), Resources.textEncoding);
  }

  public static readPublicKeys(text: string): readonly string[] {
    const keys = text.split(Resources.whitespacePattern).filter(t => t.length > 0);
    if (keys.length === 0 || new Set(keys).size !== keys.length || !keys.every(t => UpdateSignature.isPublicKey(t)))
      throw new BuildException(Resources.linuxUpdateKeysInvalid);
    return keys;
  }

  public static readPrivateKey(text: string): KeyObject {
    let key: KeyObject;
    try {
      key = createPrivateKey(text);
    }
    catch (error) {
      throw new BuildException(Resources.linuxSigningKeyInvalid, new ExceptionOptions(error));
    }
    if (key.asymmetricKeyType !== Resources.updateSignatureKeyType)
      throw new BuildException(Resources.linuxSigningKeyInvalid);
    return key;
  }

  public static formatPublicKey(key: KeyObject): string {
    return createPublicKey(key).export({ type: Resources.publicKeyEncoding, format: Resources.keyDerFormat }).toString(Resources.updateSignatureEncoding);
  }

  public static sign(key: KeyObject, message: Buffer): string {
    return sign(null, message, key).toString(Resources.updateSignatureEncoding);
  }

  public static isSignedByOneOf(keys: readonly string[], message: Buffer, signature: string): boolean {
    const bytes = Buffer.from(signature, Resources.updateSignatureEncoding);
    return bytes.length === Resources.updateSignatureLength && bytes.toString(Resources.updateSignatureEncoding) === signature && keys.some(t => verify(null, message, UpdateSignature.toPublicKey(t), bytes));
  }

  private static isPublicKey(text: string): boolean {
    try {
      return Buffer.from(text, Resources.updateSignatureEncoding).toString(Resources.updateSignatureEncoding) === text
        && UpdateSignature.toPublicKey(text).asymmetricKeyType === Resources.updateSignatureKeyType;
    }
    catch {
      return false;
    }
  }

  private static toPublicKey(text: string): KeyObject {
    return createPublicKey({ key: Buffer.from(text, Resources.updateSignatureEncoding), type: Resources.publicKeyEncoding, format: Resources.keyDerFormat });
  }
}
