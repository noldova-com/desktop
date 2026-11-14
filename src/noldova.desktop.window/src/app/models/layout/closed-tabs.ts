/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ErrorHandler } from "@angular/core";

import "@noldova/context.core";

import type { Tab } from "./tab.js";

export class ClosedTabs {
  private readonly kind: abstract new (...parameters: never[]) => Tab;
  private readonly errors: Pick<ErrorHandler, "handleError">;
  private readonly listeners: Map<string, Set<(instance: string) => void>> = new Map();
  private readonly unheard: Map<string, readonly [string, string]> = new Map();
  private readonly quiet: Set<string> = new Set();
  private known: ReadonlyMap<string, readonly [string, string]> = new Map();

  public constructor(kind: abstract new (...parameters: never[]) => Tab, errors: Pick<ErrorHandler, "handleError">) {
    this.kind = kind;
    this.errors = errors;
  }

  public onClosed(name: string, listener: (instance: string) => void): () => void {
    const listeners = this.listenersOf(name);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  public hush(tab: Tab): void {
    this.quiet.add(tab.key);
  }

  public isUnheard(tab: Tab): boolean {
    return this.unheard.has(tab.key);
  }

  public reopen(tab: Tab): void {
    this.unheard.delete(tab.key);
  }

  public reconcile(names: ReadonlySet<string>): void {
    for (const [key, [name, instance]] of [...this.unheard])
      if (names.has(name)) {
        this.unheard.delete(key);
        this.tellAll(name, instance);
      }
  }

  public notice(tabs: readonly Tab[]): readonly string[] {
    const open = new Map(tabs.flatMap((t): [string, readonly [string, string]][] => t instanceof this.kind && !Object.isUndefined(t.instance) ? [[t.key, [t.name, t.instance]]] : []));
    const closed = [...this.known].filter(([key]) => !open.has(key));
    const loud = closed.filter(([key]) => !this.quiet.has(key));
    this.known = open;
    this.quiet.clear();
    for (const [key, [name, instance]] of loud)
      if (!this.tellAll(name, instance))
        this.unheard.set(key, [name, instance]);
    return closed.map(([key]) => key);
  }

  private tellAll(name: string, instance: string): boolean {
    const listeners = [...this.listenersOf(name)];
    for (const listener of listeners)
      this.tell(listener, instance);
    return listeners.length > 0;
  }

  private listenersOf(name: string): Set<(instance: string) => void> {
    const listeners = this.listeners.get(name) ?? new Set<(instance: string) => void>();
    this.listeners.set(name, listeners);
    return listeners;
  }

  private tell(listener: (instance: string) => void, instance: string): void {
    try {
      listener(instance);
    }
    catch (error) {
      this.errors.handleError(error);
    }
  }
}
