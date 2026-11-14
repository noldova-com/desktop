/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DailyCheckMark, FeedRequestGuard, FeedSession, type IFeedNetSession } from "@noldova/desktop.electron";

@TestClass
export class FeedSessionTests {
  @TestMethod
  public installsTheGuardOnceBeforeTheFirstFetchAndReusesTheSession(): Promise<void> {
    return FeedSessionTests.withGuardAsync(async guard => {
      const events: string[] = [];
      const signal = new AbortController().signal;
      const session = new FeedSession(() => {
        events.push("create");
        return FeedSessionTests.createFake(events, signal);
      }, guard);

      const before = events.length;
      const first = await session.fetchAsync("https://updates.example.test/latest-linux-x64.yml", signal);
      const second = await session.fetchAsync("https://updates.example.test/sample-app.AppImage", signal);

      Assert.areEqual(0, before);
      Assert.areEqual([
        "create",
        "onBeforeRequest",
        "onBeforeSendHeaders",
        "onResponseStarted",
        "onErrorOccurred",
        "fetch https://updates.example.test/latest-linux-x64.yml",
        "fetch https://updates.example.test/sample-app.AppImage"
      ].join("\n"), events.join("\n"));
      Assert.areEqual("https://updates.example.test/latest-linux-x64.yml https://updates.example.test/sample-app.AppImage",
        [await first.text(), await second.text()].join(" "));
    });
  }

  private static createFake(events: string[], signal: AbortSignal): IFeedNetSession {
    return {
      webRequest: {
        onBeforeRequest: () => {
          events.push("onBeforeRequest");
        },
        onBeforeSendHeaders: () => {
          events.push("onBeforeSendHeaders");
        },
        onResponseStarted: () => {
          events.push("onResponseStarted");
        },
        onErrorOccurred: () => {
          events.push("onErrorOccurred");
        }
      },
      fetch: (url, init) => {
        events.push(init.signal === signal ? `fetch ${url}` : `fetch ${url} with another signal`);
        return Promise.resolve(new Response(url));
      }
    };
  }

  private static async withGuardAsync(test: (guard: FeedRequestGuard) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "feed-session-"));
    try {
      const mark = new DailyCheckMark(join(folder, "last-daily-update-check"), () => new Date(2026, 10, 8, 9), () => undefined);
      await test(new FeedRequestGuard("https://updates.example.test/", ["sample-app", "1.2.3", "linux", "x64"], mark, () => undefined));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
