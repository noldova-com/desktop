/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Registration } from "./registration.js";

export class ToolTurns {
  private readonly holders: Map<string, { readonly session: string; readonly waiting: (() => void)[] }> = new Map();

  public takeAsync(resource: string, session: string): Promise<Registration> | null {
    const holder = this.holders.get(resource);
    if (Object.isUndefined(holder)) {
      const taken = { session, waiting: [] };
      this.holders.set(resource, taken);
      return Promise.resolve(new Registration(() => this.pass(resource, taken)));
    }
    if (holder.session !== session)
      return null;
    return new Promise(resolve => holder.waiting.push(() => resolve(new Registration(() => this.pass(resource, holder)))));
  }

  private pass(resource: string, holder: { readonly session: string; readonly waiting: (() => void)[] }): void {
    const next = holder.waiting.shift();
    if (Object.isUndefined(next))
      this.holders.delete(resource);
    else
      next();
  }
}
