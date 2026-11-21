/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { Failure, FailureCode, type QualifiedName, Response } from "@noldova/desktop.protocol";
import { ConnectionException } from "@noldova/desktop.runtime";

import type { IRuntimeConnection } from "../interfaces/i-runtime-connection.js";
import { Resources } from "../resources.js";

export class RuntimeCaller {
  private readonly readConnection: () => IRuntimeConnection | null;

  public constructor(readConnection: () => IRuntimeConnection | null) {
    this.readConnection = readConnection;
  }

  public async callAsync(method: QualifiedName, payload: JsonValue, window?: number, signal?: AbortSignal, page?: number, timeout?: number): Promise<Response> {
    const connection = this.readConnection();
    if (Object.isNull(connection))
      return Response.failure(null, new Failure(FailureCode.Disconnected, Resources.runtimeNotConnected));
    try {
      return await connection.callAsync(method, payload, timeout, signal, window, page);
    }
    catch (error) {
      if (!(error instanceof ConnectionException))
        throw error;
      return Response.failure(null, new Failure(connection.isConnected ? FailureCode.Unavailable : FailureCode.Disconnected, error.message));
    }
  }
}
