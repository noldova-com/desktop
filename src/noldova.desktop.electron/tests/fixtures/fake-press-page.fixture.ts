/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { FakePreloadElectron } from "./fake-preload-electron.fixture.js";

export class FakeKeyboardEvent {
  public readonly type: string;
  public readonly isTrusted: boolean;
  public readonly repeat: boolean;
  public readonly timeStamp: number;

  public constructor(type: string, isTrusted: boolean, repeat: boolean, timeStamp: number) {
    this.type = type;
    this.isTrusted = isTrusted;
    this.repeat = repeat;
    this.timeStamp = timeStamp;
  }
}

export class FakePointerEvent {
  public readonly type: string;
  public readonly isTrusted: boolean;
  public readonly button: number;
  public readonly buttons: number;
  public readonly timeStamp: number;
  public readonly pointerType: string;

  public constructor(type: string, isTrusted: boolean, button: number, buttons: number, timeStamp: number, pointerType: string = "mouse") {
    this.type = type;
    this.isTrusted = isTrusted;
    this.button = button;
    this.buttons = buttons;
    this.timeStamp = timeStamp;
    this.pointerType = pointerType;
  }
}

export class FakeTouchEvent {
  public readonly type: string;
  public readonly isTrusted: boolean;
  public readonly timeStamp: number;
  public readonly changedTouches: readonly { readonly identifier: number }[];

  public constructor(type: string, isTrusted: boolean, timeStamp: number, identifiers: readonly number[]) {
    this.type = type;
    this.isTrusted = isTrusted;
    this.timeStamp = timeStamp;
    this.changedTouches = identifiers.map(identifier => ({ identifier }));
  }
}

class FakeMessagePort {
  public readonly posted: unknown[] = [];
  public onmessage: (() => void) | null = null;

  public postMessage(message: unknown): void {
    this.posted.push(message);
  }
}

export class FakePressPage {
  private readonly listeners: Map<string, (event: object) => void> = new Map();
  private readonly port: FakeMessagePort = new FakeMessagePort();

  public readonly options: Map<string, unknown> = new Map();
  public readonly electron: FakePreloadElectron;

  private constructor(load: (page: FakePressPage) => FakePreloadElectron) {
    this.electron = load(this);
  }

  public static load(): FakePressPage {
    return new FakePressPage(page => FakePressPage.withGlobals({
      addEventListener: (type: string, listener: (event: object) => void, options: unknown): void => {
        page.listeners.set(type, listener);
        page.options.set(type, options);
      },
      MessageChannel: class {
        public readonly port1: FakeMessagePort = page.port;
        public readonly port2: FakeMessagePort = page.port;
      }
    }, () => FakePreloadElectron.load(null, "press-watch.cjs")));
  }

  public dispatch(...events: readonly object[]): void {
    FakePressPage.withGlobals({ KeyboardEvent: FakeKeyboardEvent, PointerEvent: FakePointerEvent, TouchEvent: FakeTouchEvent }, () => {
      for (const event of events)
        this.listeners.get(String(Reflect.get(event, "type")))?.(event);
    });
  }

  public endTask(): void {
    this.port.posted.splice(0).forEach(() => this.port.onmessage?.());
  }

  public static event(type: string, isTrusted: boolean = true): object {
    return { type, isTrusted, timeStamp: 1 };
  }

  public reports(): string {
    return this.electron.sent.map(t => t.slice(1).join(" ")).join("|");
  }

  private static withGlobals<TResult>(values: Record<string, unknown>, run: () => TResult): TResult {
    const kept = Object.keys(values).map(t => [t, Object.getOwnPropertyDescriptor(globalThis, t)] as const);
    for (const [name, value] of Object.entries(values))
      Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    try {
      return run();
    }
    finally {
      for (const [name, descriptor] of kept)
        if (Object.isUndefined(descriptor))
          Reflect.deleteProperty(globalThis, name);
        else
          Object.defineProperty(globalThis, name, descriptor);
    }
  }
}
