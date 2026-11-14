/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CustomScheme } from "electron";

import type { ISchemeRegistry } from "@noldova/desktop.electron";

export class FakeSchemeRegistry implements ISchemeRegistry {
  private readonly refuseAfterReady: (call: string) => string;

  public readonly schemes: CustomScheme[] = [];

  public constructor(refuseAfterReady: (call: string) => string) {
    this.refuseAfterReady = refuseAfterReady;
  }

  public registerSchemesAsPrivileged(schemes: CustomScheme[]): void {
    this.refuseAfterReady("registerSchemesAsPrivileged");
    this.schemes.push(...schemes);
  }
}
