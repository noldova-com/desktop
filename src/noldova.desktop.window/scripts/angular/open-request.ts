/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IBrowserRequest } from "./interfaces/i-browser-request.ts";

export class OpenRequest {
  public readonly request: IBrowserRequest;
  public readonly started: number;

  public constructor(request: IBrowserRequest, started: number) {
    this.request = request;
    this.started = started;
  }
}
