/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { QualifiedName } from "@noldova/desktop.protocol";

import type { ISecretBackend } from "../../src/interfaces/i-secret-backend.js";

export class SecretBackendFixture implements ISecretBackend {
  private readonly values: Map<string, string> = new Map();

  public readonly calls: string[] = [];

  public saveAsync(name: QualifiedName, value: string): Promise<void> {
    this.calls.push(`save ${name.text}`);
    this.values.set(name.text, value);
    return Promise.resolve();
  }

  public readAsync(name: QualifiedName): Promise<string | null> {
    this.calls.push(`read ${name.text}`);
    return Promise.resolve(this.values.get(name.text) ?? null);
  }

  public removeAsync(name: QualifiedName): Promise<void> {
    this.calls.push(`remove ${name.text}`);
    this.values.delete(name.text);
    return Promise.resolve();
  }

  public isSetAsync(name: QualifiedName): Promise<boolean> {
    this.calls.push(`isSet ${name.text}`);
    return Promise.resolve(this.values.has(name.text));
  }
}
