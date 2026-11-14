/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export enum PermissionDecision {
  AllowedOnce = "AllowedOnce",
  AllowedAlways = "AllowedAlways",
  Denied = "Denied",
  DeniedAlways = "DeniedAlways",
  Expired = "Expired",
  Withdrawn = "Withdrawn",
  TakenOver = "TakenOver"
}
