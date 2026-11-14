/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export enum ToolFailureCode {
  Refused = "Refused",
  Denied = "Denied",
  Expired = "Expired",
  Withdrawn = "Withdrawn",
  Cancelled = "Cancelled",
  Stopped = "Stopped",
  Stale = "Stale",
  TimedOut = "TimedOut",
  OutcomeUncertain = "OutcomeUncertain",
  TooLarge = "TooLarge",
  Unavailable = "Unavailable"
}
