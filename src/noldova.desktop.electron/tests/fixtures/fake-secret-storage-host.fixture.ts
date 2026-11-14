/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ISecretStorageHost } from "@noldova/desktop.electron";

export class FakeSecretStorageHost implements ISecretStorageHost {
  public static readonly SEAL: string = "sealed:";

  public isAvailable: boolean = true;
  public backend: string = "gnome_libsecret";
  public encryptFailure: Error | null = null;
  public readonly encrypted: string[] = [];
  public readonly decrypted: string[] = [];

  public isEncryptionAvailable(): boolean {
    return this.isAvailable;
  }

  public getSelectedStorageBackend(): string {
    return this.backend;
  }

  public encryptString(plainText: string): Buffer {
    if (!Object.isNull(this.encryptFailure))
      throw this.encryptFailure;
    this.encrypted.push(plainText);
    return Buffer.from(FakeSecretStorageHost.SEAL + plainText);
  }

  public decryptString(encrypted: Buffer): string {
    const text = encrypted.toString();
    if (!text.startsWith(FakeSecretStorageHost.SEAL))
      throw new Error("Error while decrypting the ciphertext provided to safeStorage.decryptString.");
    const plainText = text.slice(FakeSecretStorageHost.SEAL.length);
    this.decrypted.push(plainText);
    return plainText;
  }
}
