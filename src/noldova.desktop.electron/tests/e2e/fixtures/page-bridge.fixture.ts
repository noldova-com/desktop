/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";
import type { Page } from "@playwright/test";

export interface IUpdateState {
  readonly kind: string;
  readonly version: string | null;
  readonly reason: string | null;
}

export interface IStartupState {
  readonly kind: string;
}

export interface IPageBridge {
  request(method: string, payload: unknown): Promise<unknown>;
  readBuild(): Promise<unknown>;
  readLayout(): Promise<unknown>;
  writeLayout(layout: unknown): Promise<unknown>;
  readStartup(): Promise<IStartupState | null>;
  onStartup(listener: (state: IStartupState) => void): () => void;
  actOnStartup(action: string): Promise<boolean>;
  readTrayAvailable(): Promise<unknown>;
  readUpdate(): Promise<IUpdateState>;
  actOnUpdate(action: string): Promise<boolean>;
  showInFolder(path: string): Promise<unknown>;
  openFile(path: string): Promise<unknown>;
  copyImage(bytes: Uint8Array): Promise<boolean>;
  openWebView(moduleId: string, pane: unknown, profileKey: string): Promise<unknown>;
  attachWebView(moduleId: string, view: string, contentsId: number): Promise<unknown>;
}

export class PageBridgeFixture {
  public static evaluateAsync<TResult>(page: Page, run: (bridge: IPageBridge) => TResult | Promise<TResult>): Promise<TResult>;
  public static evaluateAsync<TResult, TArgument>(page: Page, run: (bridge: IPageBridge, argument: TArgument) => TResult | Promise<TResult>, argument: TArgument): Promise<TResult>;
  public static async evaluateAsync<TResult>(page: Page, run: (bridge: IPageBridge, argument: unknown) => TResult | Promise<TResult>, argument?: unknown): Promise<TResult> {
    const bridge = await page.evaluateHandle(() => {
      if (globalThis.desktop === undefined)
        throw new Error("The page has no desktop bridge.");
      return globalThis.desktop;
    });
    try {
      return await bridge.evaluate(run, argument);
    }
    finally {
      await bridge.dispose();
    }
  }

  public static async payloadAsync(page: Page, method: string, payload: unknown): Promise<unknown> {
    const answer = JsonReader.fromValue(await PageBridgeFixture.evaluateAsync(page, (t, [name, value]) => t.request(name, value), [method, payload] as const));
    return answer.hasField("payload") ? answer.readValue("payload") : undefined;
  }

  public static async answerAsync(page: Page, method: string, payload: unknown): Promise<JsonReader> {
    return JsonReader.fromValue(await PageBridgeFixture.evaluateAsync(page, (t, [name, value]) => t.request(name, value), [method, payload] as const));
  }
}
