/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { KeyChord } from "@noldova/desktop.protocol";
import { ShellCommands } from "@noldova/desktop.runtime";

import type { IShortcutHost } from "../interfaces/i-shortcut-host.js";
import { Resources } from "../resources.js";

export class StopKeyController {
  private readonly host: IShortcutHost;
  private readonly isMac: boolean;
  private readonly stop: () => void;
  private readonly refuse: (key: KeyChord) => void;
  private readonly change: () => void;
  private readonly log: (text: string) => void;
  private readonly isClaimed: boolean;
  private readonly told: Set<string> = new Set();
  private key: KeyChord | null = KeyChord.parse(ShellCommands.stopAgentControlKey);
  private isActing: boolean = false;
  private isDisposed: boolean = false;
  private taken: string | null = null;
  private refusedKey: KeyChord | null = null;

  public constructor(host: IShortcutHost, platform: string, stop: () => void, refuse: (key: KeyChord) => void, change: () => void, log: (text: string) => void,
    isClaimed: boolean = true) {
    this.host = host;
    this.isMac = platform === Resources.macPlatform;
    this.stop = stop;
    this.refuse = refuse;
    this.change = change;
    this.log = log;
    this.isClaimed = isClaimed;
  }

  public get boundKey(): KeyChord | null {
    return this.key;
  }

  public get refused(): KeyChord | null {
    return this.refusedKey;
  }

  public receiveActing(isActing: boolean): void {
    this.isActing = isActing;
    this.update();
  }

  public receiveBindings(value: JsonValue): void {
    this.key = StopKeyController.keyOf(value);
    this.update();
  }

  public dispose(): void {
    this.isDisposed = true;
    this.update();
  }

  private update(): void {
    const wanted = this.isClaimed && this.isActing && !this.isDisposed ? this.key : null;
    const accelerator = Object.isNull(wanted) ? null : this.acceleratorOf(wanted);
    if (accelerator === this.taken)
      return;
    if (!Object.isNull(this.taken) && Object.isNull(this.refusedKey))
      this.host.unregister(this.taken);
    this.taken = accelerator;
    this.refusedKey = Object.isNull(wanted) || Object.isNull(accelerator) || this.take(accelerator) ? null : wanted;
    if (!Object.isNull(this.refusedKey) && !Object.isNull(accelerator) && !this.told.has(accelerator)) {
      this.told.add(accelerator);
      this.refuse(this.refusedKey);
    }
    this.change();
  }

  private take(accelerator: string): boolean {
    try {
      return this.host.register(accelerator, () => this.stop());
    }
    catch (error) {
      this.log(Resources.formatStopKeyNotTaken(accelerator, String(error)));
      return false;
    }
  }

  private acceleratorOf(key: KeyChord): string {
    const modifiers = [
      [key.hasMod, this.isMac ? Resources.commandKey : Resources.controlKey],
      [key.hasCtrl, Resources.controlKey],
      [key.hasAlt, Resources.altKey],
      [key.hasShift, Resources.shiftKey]
    ] as const;
    return [...modifiers.filter(t => t[0]).map(t => t[1]), key.key.label(false)].join(Resources.acceleratorSeparator);
  }

  private static keyOf(value: JsonValue): KeyChord | null {
    const fallback = KeyChord.parse(ShellCommands.stopAgentControlKey);
    const bindings: ReadonlyMap<string, unknown> = Object.isPlainObject(value) ? new Map(Object.entries(value)) : new Map();
    const name = ShellCommands.stopAgentControl;
    if (!bindings.has(name.text))
      return fallback;
    const bound = bindings.get(name.text);
    if (Object.isNull(bound))
      return null;
    const chord = Object.isString(bound) ? KeyChord.find(bound) : null;
    return chord?.canBind(name) === true ? chord : fallback;
  }
}
