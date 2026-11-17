/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import type { TurnOutcome } from "../enums/turn-outcome.js";
import type { Registration } from "../models/registration.js";
import type { ToolSession } from "../models/tool-session.js";
import type { IToolDescriptor } from "./i-tool-descriptor.js";
import type { IToolEndpoint } from "./i-tool-endpoint.js";
import type { IToolEndpointHandler } from "./i-tool-endpoint-handler.js";
import type { IToolHandler } from "./i-tool-handler.js";

export interface IToolsContext {
  readonly isStopped: boolean;

  register(descriptor: IToolDescriptor, handler: IToolHandler): Registration;

  openSession(scope: string, bindings: JsonObject): ToolSession;

  onSessionEnded(listener: (session: string) => void): Registration;

  openEndpointAsync(handler: IToolEndpointHandler): Promise<IToolEndpoint>;

  stopAll(reason: string): void;

  stopSession(session: string, reason: string): void;

  onSessionStopped(listener: (session: string, reason: string) => void): Registration;

  onTurnEnded(listener: (session: string, outcome: TurnOutcome) => void): Registration;

  resumeAll(): void;

  onStopped(listener: (reason: string) => void): Registration;

  onResumed(listener: () => void): Registration;
}
