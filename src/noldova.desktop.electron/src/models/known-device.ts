/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";

export class KnownDevice {
  private identity: Promise<string | null>;
  private known: string | undefined;

  public constructor() {
    this.identity = Promise.resolve(null);
    this.known = undefined;
  }

  public get current(): string | undefined {
    return this.known;
  }

  public readAsync(): Promise<string | null> {
    return this.identity;
  }

  public begin(read: Promise<string>, log: (text: string) => void): void {
    this.identity = read.then(t => {
      this.known = t;
      return t;
    }).catch((error: unknown) => {
      log(Resources.formatDeviceUnavailable(String(error)));
      return null;
    });
  }
}
