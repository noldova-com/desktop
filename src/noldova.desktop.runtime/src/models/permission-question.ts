/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";

import type { IPermissionRequest } from "../interfaces/i-permission-request.js";

export class PermissionQuestion {
  public readonly module: string;
  public readonly session: string;
  public readonly scope: string;
  public readonly request: IPermissionRequest;
  public readonly id: string;

  public constructor(module: string, session: string, scope: string, request: IPermissionRequest, id: string = randomUUID()) {
    this.module = module;
    this.session = session;
    this.scope = scope;
    this.request = request;
    this.id = id;
  }
}
