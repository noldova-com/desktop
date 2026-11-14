/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PermissionRevocation } from "../models/permission-revocation.js";
import type { Registration } from "../models/registration.js";
import type { RememberedPermission } from "../models/remembered-permission.js";
import type { IPermissionAnswerer } from "./i-permission-answerer.js";

export interface IPermissionsContext {
  registerAnswerer(answerer: IPermissionAnswerer): Registration;

  listRemembered(): readonly RememberedPermission[];

  revoke(id: string): boolean;

  onRevoked(listener: (revocation: PermissionRevocation) => void): Registration;
}
