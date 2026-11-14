/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { QualifiedName, SecretReference, SecretValue, ShellMethods } from "@noldova/desktop.protocol";

import { ForeignSecretException } from "../exceptions/foreign-secret.exception.js";
import type { IWindowSecrets } from "../interfaces/i-window-secrets.js";

export class WindowSecrets implements IWindowSecrets {
  private readonly moduleId: string;
  private readonly request: (method: string, payload: JsonValue) => Promise<JsonValue>;

  public constructor(moduleId: string, request: (method: string, payload: JsonValue) => Promise<JsonValue>) {
    this.moduleId = moduleId;
    this.request = request;
  }

  public async saveAsync(name: string, value: string): Promise<void> {
    await this.request(ShellMethods.saveSecret.text, new SecretValue(this.requireOwn(name), value).toJson());
  }

  public async removeAsync(name: string): Promise<void> {
    await this.request(ShellMethods.removeSecret.text, new SecretReference(this.requireOwn(name)).toJson());
  }

  public async isSetAsync(name: string): Promise<boolean> {
    return await this.request(ShellMethods.secretStatus.text, new SecretReference(this.requireOwn(name)).toJson()) === true;
  }

  private requireOwn(name: string): QualifiedName {
    const qualified = QualifiedName.parse(name);
    if (qualified.owner !== this.moduleId)
      throw new ForeignSecretException(this.moduleId, name);
    return qualified;
  }
}
