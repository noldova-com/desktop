/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IWebViewDebugger {
  attach(protocolVersion: string): void;
  isAttached(): boolean;
  detach(): void;
  sendCommand(method: string, params: object): Promise<unknown>;
  on(event: "message", listener: (event: unknown, method: string, params: unknown, sessionId: string) => void): unknown;
  on(event: "detach", listener: (event: unknown, reason: string) => void): unknown;
}
