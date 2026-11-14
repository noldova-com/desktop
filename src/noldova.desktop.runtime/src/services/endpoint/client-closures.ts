/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import type { ClientClosure } from "../../models/client-closure.js";
import { Registration } from "../../models/registration.js";
import { Resources } from "../../resources.js";

export class ClientClosures {
  private readonly listeners: Set<{ readonly listener: (closure: ClientClosure) => void | Promise<void> }> = new Set();
  private readonly diagnostics: Writable;

  public constructor(diagnostics: Writable) {
    this.diagnostics = diagnostics;
  }

  public listen(listener: (closure: ClientClosure) => void | Promise<void>): Registration {
    const entry = { listener };
    this.listeners.add(entry);
    return new Registration(() => this.listeners.delete(entry));
  }

  public report(closure: ClientClosure): void {
    for (const entry of [...this.listeners])
      if (this.listeners.has(entry))
        Promise.try(() => entry.listener(closure)).catch((error: unknown) =>
          this.diagnostics.write(Resources.formatClosureNotHeard(closure.connection, closure.window, String(error))));
  }
}
