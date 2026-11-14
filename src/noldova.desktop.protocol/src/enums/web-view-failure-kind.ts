/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export enum WebViewFailureKind {
  NotOwned = "NotOwned",
  NotAllowed = "NotAllowed",
  ShortcutRefused = "ShortcutRefused",
  TimedOut = "TimedOut",
  TooLarge = "TooLarge",
  ViewClosed = "ViewClosed",
  Crashed = "Crashed",
  ProfileCleared = "ProfileCleared",
  Unavailable = "Unavailable",
  Protocol = "Protocol"
}
