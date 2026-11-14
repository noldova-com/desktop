/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IKeyStroke, KeyChord } from "@noldova/desktop.protocol";

import type { CommandContribution } from "./command-contribution.js";
import { ShortcutCollision } from "./shortcut-collision.js";
import type { ShortcutBinding } from "./shortcut-binding.js";

export class ShortcutMap {
  private readonly platform: string;
  private readonly entries: (readonly [KeyChord, string])[] = [];
  private readonly collisionList: ShortcutCollision[] = [];
  private readonly pageKeys: Set<KeyChord> = new Set();

  public constructor(shellKeys: readonly (readonly [KeyChord, string])[], commands: readonly CommandContribution[], bindings: readonly ShortcutBinding[], platform: string,
    pageFirst: readonly KeyChord[] = []) {
    this.platform = platform;
    const names = new Set(commands.map(t => t.name));
    const bound = new Set(bindings.map(t => t.command));
    for (const binding of bindings) {
      if (!Object.isNull(binding.key) && names.has(binding.command))
        this.assign(binding.key, binding.command);
    }
    for (const [key, command] of shellKeys) {
      if (names.has(command) && !bound.has(command))
        this.assign(key, command, pageFirst.some(t => t.isSameOn(key, platform)));
    }
    for (const command of commands) {
      if (!Object.isNull(command.defaultKey) && !bound.has(command.name))
        this.assign(command.defaultKey, command.name);
    }
  }

  public get keys(): readonly KeyChord[] {
    return this.entries.map(t => t[0]);
  }

  public get pairs(): readonly (readonly [KeyChord, string])[] {
    return [...this.entries];
  }

  public get viewKeys(): readonly KeyChord[] {
    return this.keys.filter(t => !this.pageKeys.has(t));
  }

  public get collisions(): readonly ShortcutCollision[] {
    return this.collisionList;
  }

  public find(stroke: IKeyStroke): string | undefined {
    return this.entries.find(t => t[0].matches(stroke, this.platform))?.[1];
  }

  public keyOf(command: string): KeyChord | null {
    return this.entries.find(t => t[1] === command)?.[0] ?? null;
  }

  public holderOf(key: KeyChord): string | undefined {
    return this.entries.find(t => t[0].isSameOn(key, this.platform))?.[1];
  }

  private assign(key: KeyChord, command: string, isPageFirst: boolean = false): void {
    const holder = this.holderOf(key);
    if (!Object.isUndefined(holder)) {
      this.collisionList.push(new ShortcutCollision(key, holder, command));
      return;
    }
    this.entries.push([key, command]);
    if (isPageFirst)
      this.pageKeys.add(key);
  }
}
