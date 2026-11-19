/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createRequire, Module } from "node:module";
import path from "node:path";

import "@noldova/context.core";
import { Assert } from "@noldova/context.testing";

import { PreloadSettings } from "../../src/models/preload-settings.js";
import { ListenerRegistry } from "./listener-registry.fixture.js";

export class FakePreloadElectron {
  private readonly listeners: ListenerRegistry = new ListenerRegistry();
  private readonly exposed: Map<string, Record<string, unknown>> = new Map();

  public readonly paths: Map<object, string> = new Map();
  public readonly failures: Map<object, Error> = new Map();
  public readonly sent: unknown[][] = [];
  public readonly invoked: unknown[][] = [];
  public readonly waited: unknown[][] = [];
  public answer: (values: readonly unknown[]) => unknown = values => values.length % 2 === 0;
  public readonly contextBridge: object = {
    exposeInMainWorld: (name: string, api: Record<string, unknown>): void => {
      this.exposed.set(name, api);
    }
  };

  public readonly ipcRenderer: object = {
    send: (...values: unknown[]): void => {
      this.sent.push(values);
    },
    sendSync: (...values: unknown[]): unknown => {
      this.waited.push(values);
      return this.answer(values);
    },
    invoke: (...values: unknown[]): Promise<unknown> => {
      this.invoked.push(values);
      return Promise.resolve(this.answer(values));
    },
    on: (channel: string, listener: (...values: never[]) => unknown): void => this.listeners.add(channel, listener),
    removeListener: (channel: string, listener: (...values: never[]) => unknown): void => this.listeners.remove(channel, listener)
  };

  public readonly webUtils: object = {
    getPathForFile: (file: unknown): string => {
      if (!Object.isObject(file))
        throw new TypeError("Not a file.");
      const failure = this.failures.get(file);
      if (!Object.isUndefined(failure))
        throw failure;
      return this.paths.get(file) ?? String.empty;
    }
  };

  public static load(argument: string | null = new PreloadSettings(null).toArgument(), file: string = "preload.cjs"): FakePreloadElectron {
    const electron = new FakePreloadElectron();
    const require = createRequire(import.meta.url);
    const preloadPath = path.join(path.dirname(require.resolve("@noldova/desktop.electron/package.json")), file);
    const electronPath = createRequire(preloadPath).resolve("electron");
    const fake = new Module(electronPath);
    fake.filename = electronPath;
    fake.loaded = true;
    fake.exports = electron;
    const added = Object.isNull(argument) ? [] : [argument];
    process.argv.push(...added);
    require.cache[electronPath] = fake;
    try {
      require(preloadPath);
    }
    finally {
      delete require.cache[electronPath];
      delete require.cache[preloadPath];
      process.argv.splice(process.argv.length - added.length, added.length);
    }
    return electron;
  }

  public get exposedNames(): readonly string[] {
    return [...this.exposed.keys()];
  }

  public api(name: string): Record<string, unknown> {
    const api = this.exposed.get(name);
    Assert.isDefined(api);
    return api;
  }

  public emit(channel: string, ...values: unknown[]): void {
    this.listeners.emit(channel, {}, ...values);
  }

  public count(channel: string): number {
    return this.listeners.count(channel);
  }
}
