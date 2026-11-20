/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export enum WebViewEventKind {
  Opened = "Opened",
  Closed = "Closed",
  State = "State",
  LoadFailed = "LoadFailed",
  NavigationRefused = "NavigationRefused",
  FrameNavigationRefused = "FrameNavigationRefused",
  Crashed = "Crashed",
  ProfileCleared = "ProfileCleared",
  RequestRefused = "RequestRefused",
  NewWindowRequested = "NewWindowRequested",
  Protocol = "Protocol",
  Dropped = "Dropped",
  Key = "Key",
  Zoom = "Zoom",
  Found = "Found",
  Favicon = "Favicon",
  Controlled = "Controlled"
}
