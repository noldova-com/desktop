/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { QualifiedName, WebViewPane } from "@noldova/desktop.protocol";

import { WebViewClosedException } from "../../../src/app/exceptions/web-view-closed.exception";
import type { IWebViewHandle } from "../../../src/app/interfaces/i-web-view-handle";
import { WindowWebViews } from "../../../src/app/models/window-web-views";
import { WebViewHandleFixture } from "../../fixtures/web-view-handle.fixture";

describe("WindowWebViews", () => {
  const list = new WebViewPane(QualifiedName.parse("notes.list"));
  let opened: WebViewHandleFixture[];
  let opens: string[];

  function views(): WindowWebViews {
    return new WindowWebViews((pane, profileKey) => {
      opens.push(`${pane.name.text} ${profileKey}`);
      const handle = new WebViewHandleFixture(`view-${opened.length + 1}`, pane, profileKey);
      opened.push(handle);
      return Promise.resolve(handle);
    });
  }

  beforeEach(() => {
    opened = [];
    opens = [];
  });

  it("opens a web view in the pane with the profile and hands it back", async () => {
    const handle: IWebViewHandle = await views().openAsync(list, "workspace-1");

    expect(opens).toEqual(["notes.list workspace-1"]);
    expect(handle).toBe(opened[0]);
  });

  it("closes every web view it opened that is still open when withdrawn, and none twice", async () => {
    const webViews = views();
    await webViews.openAsync(list, "workspace-1");
    await webViews.openAsync(list, "workspace-2");
    opened[0]?.close();

    webViews.withdraw();

    expect(opened.map(t => t.calls)).toEqual([["close"], ["close"]]);
  });

  it("forgets web views closed since, so a later withdrawal closes only the open ones", async () => {
    const webViews = views();
    await webViews.openAsync(list, "workspace-1");
    opened[0]?.close();
    await webViews.openAsync(list, "workspace-2");

    webViews.withdraw();

    expect(opened.map(t => t.calls)).toEqual([["close"], ["close"]]);
  });

  it("closes a web view that finishes opening after the withdrawal and refuses it", async () => {
    let finish: (handle: IWebViewHandle) => void = () => undefined;
    const late = new WebViewHandleFixture("view-late", list, "workspace-1");
    const webViews = new WindowWebViews(() => new Promise(resolve => {
      finish = resolve;
    }));

    const opening = webViews.openAsync(list, "workspace-1");
    webViews.withdraw();
    finish(late);

    await expect(opening).rejects.toThrowError("The web view is closed.");
    await expect(opening).rejects.toBeInstanceOf(WebViewClosedException);
    expect(late.calls).toEqual(["close"]);
  });

  it("closes and refuses a web view opened once withdrawn", async () => {
    const webViews = views();
    webViews.withdraw();

    await expect(webViews.openAsync(list, "workspace-1")).rejects.toBeInstanceOf(WebViewClosedException);
    expect(opened.map(t => t.calls)).toEqual([["close"]]);
  });
});
