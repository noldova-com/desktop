/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { URL } from "node:url";

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class UpdateFeedAddress {
  public readonly address: string;

  public constructor(address: string) {
    this.address = address;
  }

  public get host(): string {
    return URL.canParse(this.address) ? new URL(this.address).host : Resources.invalidAddress;
  }

  public get refusal(): string {
    return Resources.formatDevelopmentFeedRefused(this.host);
  }

  public isLocal(): boolean {
    return URL.canParse(this.address) && Resources.localFeedHosts.includes(new URL(this.address).hostname);
  }

  public isAllowed(isPackaged: boolean): boolean {
    return isPackaged || this.isLocal();
  }
}
