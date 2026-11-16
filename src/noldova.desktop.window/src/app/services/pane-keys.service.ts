/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, type WritableSignal, computed, signal } from "@angular/core";

import "@noldova/context.core";
import type { KeyChord } from "@noldova/desktop.protocol";

@Injectable({ providedIn: "root" })
export class PaneKeysService {
  private readonly views: WritableSignal<ReadonlyMap<string, readonly [string, readonly KeyChord[]]>> = signal(new Map());

  public readonly keys: Signal<readonly (readonly [string, KeyChord])[]> = computed(() => [...this.views().values()].flatMap(([module, keys]) => keys.map(t => [module, t] as const)));

  public add(view: string, module: string, keys: readonly KeyChord[]): void {
    this.views.update(t => new Map([...t, [view, [module, keys] as const]]));
  }

  public remove(view: string): void {
    this.views.update(t => new Map([...t].filter(u => u[0] !== view)));
  }
}
