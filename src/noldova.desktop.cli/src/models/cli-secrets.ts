/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonValue } from "@noldova/context.json";
import { QualifiedName, SecretReference, SecretValue, ShellMethods } from "@noldova/desktop.protocol";

import type { ICliSecrets } from "../interfaces/i-cli-secrets.js";
import { Resources } from "../resources.js";

export class CliSecrets implements ICliSecrets {
  private readonly moduleId: string;
  private readonly request: (method: QualifiedName, payload: JsonValue, signal: AbortSignal) => Promise<JsonValue>;

  public constructor(moduleId: string, request: (method: QualifiedName, payload: JsonValue, signal: AbortSignal) => Promise<JsonValue>) {
    this.moduleId = moduleId;
    this.request = request;
  }

  public async saveAsync(name: string, value: string, signal: AbortSignal): Promise<void> {
    await this.request(ShellMethods.saveSecret, new SecretValue(this.requireOwn(name), value).toJson(), signal);
  }

  public async removeAsync(name: string, signal: AbortSignal): Promise<void> {
    await this.request(ShellMethods.removeSecret, new SecretReference(this.requireOwn(name)).toJson(), signal);
  }

  public async isSetAsync(name: string, signal: AbortSignal): Promise<boolean> {
    return await this.request(ShellMethods.secretStatus, new SecretReference(this.requireOwn(name)).toJson(), signal) === true;
  }

  private requireOwn(name: string): QualifiedName {
    const qualified = QualifiedName.parse(name, Resources.nameParameterName);
    if (qualified.owner !== this.moduleId)
      throw new ArgumentException(Resources.formatSecretNotOwn(this.moduleId, name), Resources.nameParameterName);
    return qualified;
  }
}
