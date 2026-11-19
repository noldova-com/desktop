/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IDeviceChooserContents, IPreventableEvent } from "@noldova/desktop.electron";

import { FakePreventableEvent } from "./fake-preventable-event.fixture.js";
import { ListenerRegistry } from "./listener-registry.fixture.js";

export class FakeDeviceChooserContents implements IDeviceChooserContents {
  private readonly listeners: ListenerRegistry = new ListenerRegistry();

  public on(event: "select-bluetooth-device", listener: (event: IPreventableEvent, devices: readonly unknown[], choose: (deviceId: string) => void) => void): this {
    this.listeners.add(event, listener);
    return this;
  }

  public chooseBluetoothDevice(devices: readonly unknown[]): { readonly isPrevented: boolean; readonly chosen: readonly string[] } {
    const event = new FakePreventableEvent();
    const chosen: string[] = [];
    this.listeners.emit("select-bluetooth-device", event, devices, (deviceId: string) => chosen.push(deviceId));
    return { isPrevented: event.isPrevented, chosen };
  }
}
