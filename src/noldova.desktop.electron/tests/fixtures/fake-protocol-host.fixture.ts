/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IProtocolHost } from "@noldova/desktop.electron";

export class FakeProtocolHost implements IProtocolHost {
  public readonly handlers: Map<string, (request: Request) => Promise<Response>> = new Map();
  public readonly handled: string[] = [];

  public handle(scheme: string, handler: (request: Request) => Promise<Response>): void {
    this.handled.push(scheme);
    this.handlers.set(scheme, handler);
  }

  public isProtocolHandled(scheme: string): boolean {
    return this.handlers.has(scheme);
  }

  public serveAsync(address: string): Promise<Response> {
    const handler = this.handlers.get(new URL(address).protocol.slice(0, -1));
    return Object.isUndefined(handler) ? Promise.resolve(Response.error()) : handler(new Request(address));
  }
}
