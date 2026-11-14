/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import type { JsonObject } from "@noldova/context.json";

import { Registration } from "../../models/registration.js";
import { Resources } from "../../resources.js";

export class ReportedList<T extends { toJson(): JsonObject }> {
  private readonly empty: T;
  private readonly name: string;
  private readonly diagnostics: Writable;
  private readonly listeners: Set<() => void> = new Set();
  private value: T;
  private connection: number | null = null;

  public constructor(empty: T, name: string, diagnostics: Writable) {
    this.empty = empty;
    this.name = name;
    this.diagnostics = diagnostics;
    this.value = empty;
  }

  public get current(): T {
    return this.value;
  }

  public receive(connection: number, value: T): void {
    const isNewConnection = connection !== this.connection;
    this.connection = connection;
    this.replace(value, isNewConnection);
  }

  public close(connection: number): void {
    if (connection !== this.connection)
      return;
    this.connection = null;
    this.replace(this.empty, true);
  }

  public listen(listener: () => void): Registration {
    const entry = (): void => listener();
    this.listeners.add(entry);
    return new Registration(() => this.listeners.delete(entry));
  }

  private replace(value: T, isNewConnection: boolean): void {
    const isSame = !isNewConnection && JSON.stringify(value.toJson()) === JSON.stringify(this.value.toJson());
    this.value = value;
    if (isSame)
      return;
    for (const listener of [...this.listeners])
      this.tell(listener);
  }

  private tell(listener: () => void): void {
    if (!this.listeners.has(listener))
      return;
    try {
      listener();
    }
    catch (error) {
      this.diagnostics.write(Resources.formatAppSurfaceNotHeard(this.name, String(error)));
    }
  }
}
