/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { WebViewHistory } from "@noldova/desktop.electron";
import type { NavigationEntry } from "electron";

@TestClass
export class WebViewHistoryTests {
  @TestMethod
  public keepsItsOwnCopyOfTheEntriesItWasGiven(): void {
    const entries: NavigationEntry[] = [{ url: "https://example.com/a", title: "A", pageState: "state a" }];
    const history = new WebViewHistory(entries, 0);

    entries.push({ url: "https://example.com/b", title: "B" });

    Assert.areEqual(JSON.stringify([[{ url: "https://example.com/a", title: "A", pageState: "state a" }], 0]), JSON.stringify([history.entries, history.index]));
  }

  @TestMethod
  @TestData(0, "https://example.com/a")
  @TestData(1, "https://example.com/b")
  @TestData(2, null)
  @TestData(-1, null)
  public namesTheAddressOfItsCurrentEntryOrNoneForAnIndexOutsideIt(index: number, url: string | null): void {
    const history = new WebViewHistory([{ url: "https://example.com/a", title: "A" }, { url: "https://example.com/b", title: "B" }], index);

    Assert.areEqual(url, history.currentUrl);
  }
}
