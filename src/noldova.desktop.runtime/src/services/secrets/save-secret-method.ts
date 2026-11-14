/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { SecretValue } from "@noldova/desktop.protocol";

import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { ISecretBackend } from "../../interfaces/i-secret-backend.js";
import type { RequestContext } from "../../models/request-context.js";

export class SaveSecretMethod implements IMethodHandler {
  private readonly backend: ISecretBackend;

  public constructor(backend: ISecretBackend) {
    this.backend = backend;
  }

  public async handleAsync(context: RequestContext): Promise<JsonValue> {
    const secret = SecretValue.fromJson(context.payload);
    await this.backend.saveAsync(secret.name, secret.value);
    return null;
  }
}
