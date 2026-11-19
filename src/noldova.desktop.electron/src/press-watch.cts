/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import electron = require("electron");

class PressWatch {
  private static readonly CHANNEL: string = "desktop:web-view-press";
  private static readonly START: string = "start";
  private static readonly RESUME: string = "resume";
  private static readonly END: string = "end";
  private static readonly POINTER_DOWN: string = "pointerdown";
  private static readonly POINTER_MOVE: string = "pointermove";
  private static readonly KEY_DOWN: string = "keydown";
  private static readonly TOUCH_START: string = "touchstart";
  private static readonly TOUCH: string = "touch";
  private static readonly DURING: readonly string[] = ["mousedown", "pointerup", "mouseup", "click", "auxclick", "dblclick", "contextmenu", "keypress", "keyup", "touchend"];
  private static readonly BUTTON_BITS: readonly number[] = [1, 4, 2, 8, 16];

  private readonly ending: MessageChannel = new MessageChannel();
  private isOpen: boolean = false;

  public watch(target: EventTarget): void {
    this.ending.port1.onmessage = (): void => this.end();
    for (const type of [PressWatch.POINTER_DOWN, PressWatch.POINTER_MOVE, PressWatch.KEY_DOWN, PressWatch.TOUCH_START, ...PressWatch.DURING])
      target.addEventListener(type, event => this.note(event), { capture: true, passive: true });
  }

  private note(event: Event): void {
    if (!event.isTrusted || PressWatch.isTouchPointer(event))
      return;
    if ("TouchEvent" in globalThis && event instanceof TouchEvent && event.type === PressWatch.TOUCH_START) {
      electron.ipcRenderer.send(PressWatch.CHANNEL, PressWatch.START, event.timeStamp, Array.from(event.changedTouches, t => t.identifier));
      return this.open();
    }
    if (PressWatch.isStart(event)) {
      electron.ipcRenderer.send(PressWatch.CHANNEL, PressWatch.START, event.timeStamp);
      return this.open();
    }
    if (event.type === PressWatch.POINTER_MOVE || this.isOpen)
      return;
    electron.ipcRenderer.send(PressWatch.CHANNEL, PressWatch.RESUME);
    this.open();
  }

  private open(): void {
    if (this.isOpen)
      return;
    this.isOpen = true;
    this.ending.port2.postMessage(null);
    setTimeout(() => this.end(), 0);
  }

  private end(): void {
    if (!this.isOpen)
      return;
    this.isOpen = false;
    electron.ipcRenderer.send(PressWatch.CHANNEL, PressWatch.END);
  }

  private static isTouchPointer(event: Event): boolean {
    return event instanceof PointerEvent && event.pointerType === PressWatch.TOUCH && event.type !== PressWatch.POINTER_MOVE;
  }

  private static isStart(event: Event): boolean {
    if (event.type === PressWatch.POINTER_DOWN)
      return true;
    if (event.type === PressWatch.KEY_DOWN)
      return event instanceof KeyboardEvent && !event.repeat;
    if (event.type !== PressWatch.POINTER_MOVE || !(event instanceof PointerEvent))
      return false;
    return event.button >= 0 && (event.buttons & (PressWatch.BUTTON_BITS.at(event.button) ?? 0)) !== 0;
  }
}

new PressWatch().watch(globalThis);
