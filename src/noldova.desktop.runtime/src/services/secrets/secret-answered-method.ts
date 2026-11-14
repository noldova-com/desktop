/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { SecretAnswered } from "@noldova/desktop.protocol";

import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import type { MachineSecretBackend } from "./machine-secret-backend.js";

export class SecretAnsweredMethod implements IMethodHandler {
  private readonly backend: MachineSecretBackend;

  public constructor(backend: MachineSecretBackend) {
    this.backend = backend;
  }

  public handleAsync(context: RequestContext): Promise<JsonValue> {
    this.backend.answer(context.connection, SecretAnswered.fromJson(context.payload));
    return Promise.resolve(null);
  }
}
