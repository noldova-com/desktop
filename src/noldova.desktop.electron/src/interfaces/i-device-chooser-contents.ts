/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPreventableEvent } from "./i-preventable-event.js";

export interface IDeviceChooserContents {
  on(event: "select-bluetooth-device", listener: (event: IPreventableEvent, devices: readonly unknown[], choose: (deviceId: string) => void) => void): unknown;
}
