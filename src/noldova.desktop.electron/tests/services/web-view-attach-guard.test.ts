/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import type { IWebViewAttachParams } from "../../src/interfaces/i-web-view-attach-params.js";
import type { IWebViewAttachPreferences } from "../../src/interfaces/i-web-view-attach-preferences.js";
import { WebViewAttachGuard } from "../../src/services/web-view-attach-guard.js";
import { FakePreventableEvent } from "../fixtures/fake-preventable-event.fixture.js";

@TestClass
export class WebViewAttachGuardTests {
  private static readonly WINDOW: number = 3;
  private static readonly PARTITION: string = "persist:browser.workspace-1";

  @TestMethod
  public allowsTheWindowsWebviewOnABlankPageInItsViewsPartitionAndLocksItDown(): void {
    const [guard, asked, logs] = WebViewAttachGuardTests.create();
    const event = new FakePreventableEvent();
    const preferences: IWebViewAttachPreferences = {
      preload: "file:///forbidden.js",
      preloadURL: "file:///forbidden.js",
      nodeIntegration: true,
      nodeIntegrationInSubFrames: true,
      nodeIntegrationInWorker: true,
      contextIsolation: false,
      sandbox: false,
      webviewTag: true,
      navigateOnDragDrop: true,
      safeDialogs: false,
      zoomMode: "default"
    };

    guard.judge(WebViewAttachGuardTests.WINDOW, false, event, preferences, { src: "about:blank", partition: WebViewAttachGuardTests.PARTITION });

    Assert.isFalse(event.isPrevented);
    Assert.areEqual(JSON.stringify({
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      navigateOnDragDrop: false,
      safeDialogs: true,
      zoomMode: "isolated"
    }), JSON.stringify(preferences));
    Assert.areEqual(`3 ${WebViewAttachGuardTests.PARTITION}`, asked.join(","));
    Assert.areEqual(0, logs.length);
  }

  @TestMethod
  public dropsTheWebviewsOwnBlinkFeaturesSoItKeepsTheWindowsOnes(): void {
    const [guard] = WebViewAttachGuardTests.create();
    const preferences: IWebViewAttachPreferences = { disableBlinkFeatures: "Auxclick", enableBlinkFeatures: "WebBluetooth", experimentalFeatures: true };

    guard.judge(WebViewAttachGuardTests.WINDOW, false, new FakePreventableEvent(), preferences, { src: "about:blank", partition: WebViewAttachGuardTests.PARTITION });

    Assert.areEqual(JSON.stringify([false, false, false]), JSON.stringify(["disableBlinkFeatures", "enableBlinkFeatures", "experimentalFeatures"].map(t => t in preferences)));
  }

  @TestMethod
  @TestData("persist:other.workspace-1", "about:blank")
  @TestData(null, "about:blank")
  @TestData(null, "https://example.com/")
  public refusesAndLogsAnIntruderWebviewWithAnotherPartition(partition: string | null, src: string): void {
    const [guard, , logs] = WebViewAttachGuardTests.create();
    const event = new FakePreventableEvent();
    const preferences: IWebViewAttachPreferences = { preload: "file:///forbidden.js" };

    guard.judge(WebViewAttachGuardTests.WINDOW, false, event, preferences, Object.isNull(partition) ? { src } : { src, partition });

    Assert.isTrue(event.isPrevented);
    Assert.areEqual("file:///forbidden.js", preferences.preload);
    Assert.areEqual(`A <webview> in window 3 was refused, because its partition "${partition ?? String.empty}" belongs to no web view the window opened.`,
      logs.join("|"));
  }

  @TestMethod
  @TestData("https://example.com/form")
  @TestData(String.empty)
  @TestData(null)
  public startsTheWindowsWebviewInItsViewsPartitionOnABlankPageWhateverAddressItCarries(src: string | null): void {
    const [guard, , logs] = WebViewAttachGuardTests.create();
    const event = new FakePreventableEvent();
    const params: IWebViewAttachParams = Object.isNull(src) ? { partition: WebViewAttachGuardTests.PARTITION } : { src, partition: WebViewAttachGuardTests.PARTITION };

    guard.judge(WebViewAttachGuardTests.WINDOW, false, event, {}, params);

    Assert.isFalse(event.isPrevented);
    Assert.areEqual("about:blank", params.src);
    Assert.areEqual(0, logs.length);
  }

  @TestMethod
  @TestData("https://example.com/form")
  @TestData(null)
  public startsAWebviewAViewClaimsWithNoPageSoTheViewCanRestoreItsOwn(src: string | null): void {
    const [guard, , logs] = WebViewAttachGuardTests.create([`${WebViewAttachGuardTests.WINDOW} ${WebViewAttachGuardTests.PARTITION}`]);
    const event = new FakePreventableEvent();
    const preferences: IWebViewAttachPreferences = { preload: "file:///forbidden.js", sandbox: false };
    const params: IWebViewAttachParams = Object.isNull(src) ? { partition: WebViewAttachGuardTests.PARTITION } : { src, partition: WebViewAttachGuardTests.PARTITION };

    guard.judge(WebViewAttachGuardTests.WINDOW, false, event, preferences, params);

    Assert.isFalse(event.isPrevented);
    Assert.areEqual(String.empty, params.src);
    Assert.areEqual(JSON.stringify([undefined, true]), JSON.stringify([preferences.preload, preferences.sandbox]));
    Assert.areEqual(0, logs.length);
  }

  @TestMethod
  public refusesAWebviewInsideAWebViewsPageWithoutAsking(): void {
    const [guard, asked, logs] = WebViewAttachGuardTests.create();
    const event = new FakePreventableEvent();

    guard.judge(WebViewAttachGuardTests.WINDOW, true, event, {}, { src: "about:blank", partition: WebViewAttachGuardTests.PARTITION });

    Assert.isTrue(event.isPrevented);
    Assert.areEqual("0,0", [asked.length, logs.length].join(","));
  }

  private static create(claimed: string[] = []): [WebViewAttachGuard, string[], string[]] {
    const asked: string[] = [];
    const logs: string[] = [];
    const guard = new WebViewAttachGuard((windowId, partition) => {
      asked.push(`${windowId} ${partition}`);
      return windowId === WebViewAttachGuardTests.WINDOW && partition === WebViewAttachGuardTests.PARTITION;
    }, (windowId, partition) => claimed.includes(`${windowId} ${partition}`), t => logs.push(t));
    return [guard, asked, logs];
  }
}
