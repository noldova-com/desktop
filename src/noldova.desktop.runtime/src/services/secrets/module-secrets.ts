/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { QualifiedName, SecretValue } from "@noldova/desktop.protocol";

import { SecretNotOwnedException } from "../../exceptions/secret-not-owned.exception.js";
import type { IModuleSecrets } from "../../interfaces/i-module-secrets.js";
import type { ISecretBackend } from "../../interfaces/i-secret-backend.js";

export class ModuleSecrets implements IModuleSecrets {
  private readonly moduleId: string;
  private readonly backend: ISecretBackend;

  public constructor(moduleId: string, backend: ISecretBackend) {
    this.moduleId = moduleId;
    this.backend = backend;
  }

  public async saveAsync(name: string, value: string): Promise<void> {
    const secret = new SecretValue(this.requireOwn(name), value);
    await this.backend.saveAsync(secret.name, secret.value);
  }

  public async readAsync(name: string): Promise<string | null> {
    return await this.backend.readAsync(this.requireOwn(name));
  }

  public async removeAsync(name: string): Promise<void> {
    await this.backend.removeAsync(this.requireOwn(name));
  }

  public async isSetAsync(name: string): Promise<boolean> {
    return await this.backend.isSetAsync(this.requireOwn(name));
  }

  private requireOwn(name: string): QualifiedName {
    const qualified = QualifiedName.parse(name);
    if (qualified.owner !== this.moduleId)
      throw new SecretNotOwnedException(this.moduleId, name);
    return qualified;
  }
}
