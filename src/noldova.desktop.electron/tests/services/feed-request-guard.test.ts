/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DailyCheckMark, FeedRequestGuard, type IFeedWebRequest } from "@noldova/desktop.electron";

@TestClass
export class FeedRequestGuardTests {
  private static readonly PRODUCT: readonly [string, string, string, string] = ["sample-app", "1.2.3", "linux", "x64"];
  private static readonly USER_AGENT: string = "sample-app/1.2.3 (linux; x64)";
  private static readonly DAILY_USER_AGENT: string = "sample-app/1.2.3 (linux; x64; daily)";

  @TestMethod
  public namesTheAppItsVersionPlatformAndArchitectureAndTheDaysFirstCheckInTheUserAgent(): void {
    Assert.areEqual(FeedRequestGuardTests.USER_AGENT, FeedRequestGuard.formatUserAgent(FeedRequestGuardTests.PRODUCT, false));
    Assert.areEqual(FeedRequestGuardTests.DAILY_USER_AGENT, FeedRequestGuard.formatUserAgent(FeedRequestGuardTests.PRODUCT, true));
    Assert.areEqual("sample-app/1.3.0-internal.4 (darwin; arm64)", FeedRequestGuard.formatUserAgent(["sample-app", "1.3.0-internal.4", "darwin", "arm64"], false));
  }

  @TestMethod
  public allowsOnlyTheAppsOwnFeedsOriginAndGitHubsReleaseAssetHost(): Promise<void> {
    return FeedRequestGuardTests.withGuardAsync("https://updates.example.test/sample-app/", guard => {
      const urls = [
        "https://updates.example.test/sample-app/latest-linux-x64.yml",
        "https://updates.example.test/v1.2.3/Sample%20App-linux-x64.AppImage",
        "https://release-assets.githubusercontent.com/github-production-release-asset/1/2?sp=r",
        "https://objects.githubusercontent.com/github-production-release-asset-2e65be/1/2",
        "http://updates.example.test/sample-app/latest-linux-x64.yml",
        "https://updates.example.test:8443/sample-app/latest-linux-x64.yml",
        "https://github.com/example/sample-app/releases/download/v1.2.3/latest-linux-x64.yml",
        "https://evil.example.test/latest-linux-x64.yml",
        "not a url"
      ];

      Assert.areEqual("true true true true false false false false false", urls.map(t => guard.allows(t)).join(" "));
      return Promise.resolve();
    });
  }

  @TestMethod
  public keepsEachHostOfTodaysGitHubFeedAndNoOther(): Promise<void> {
    return FeedRequestGuardTests.withGuardAsync("https://github.com/example/sample-app/releases/latest/download/", guard => {
      const used = [
        "https://github.com/example/sample-app/releases/latest/download/latest-linux-x64.yml",
        "https://github.com/example/sample-app/releases/download/v1.2.3/latest-linux-x64.yml",
        "https://github.com/example/sample-app/releases/download/v1.2.3/Sample%20App-linux-x64.AppImage",
        "https://release-assets.githubusercontent.com/github-production-release-asset/1/2?sp=r&sig=x",
        "https://objects.githubusercontent.com/github-production-release-asset-2e65be/1/2?X-Amz-Signature=x"
      ];
      const unused = ["https://api.github.com/repos/example/sample-app/releases/latest", "https://codeload.github.com/example/sample-app/zip/main", "https://www.github.com/"];

      Assert.areEqual(used.map(() => true).join(" "), used.map(t => guard.allows(t)).join(" "));
      Assert.areEqual(unused.map(() => false).join(" "), unused.map(t => guard.allows(t)).join(" "));
      return Promise.resolve();
    });
  }

  @TestMethod
  public keepsAnInternalFeedAndALoopbackTestFeedOnTheirOwnOrigin(): Promise<void> {
    return FeedRequestGuardTests.withGuardAsync("https://updates.internal.example.test/sample-app/", async internal => {
      await FeedRequestGuardTests.withGuardAsync("http://127.0.0.1:47325/", loopback => {
        Assert.isTrue(internal.allows("https://updates.internal.example.test/sample-app/latest-linux-x64.yml"));
        Assert.isTrue(internal.allows("https://updates.internal.example.test/sample-app/Sample%20App-1.3.0-internal.4-linux-x64.AppImage"));
        Assert.isFalse(internal.allows("https://github.com/example/sample-app/releases/latest/download/latest-linux-x64.yml"));
        Assert.isTrue(loopback.allows("http://127.0.0.1:47325/latest-linux-x64.yml"));
        Assert.isFalse(loopback.allows("http://127.0.0.1:47326/latest-linux-x64.yml"));
        Assert.isFalse(loopback.allows("http://localhost:47325/latest-linux-x64.yml"));
        return Promise.resolve();
      });
    });
  }

  @TestMethod
  public sendsItsUserAgentAndOfItsOwnHeadersOnlyAcceptRangeAndCacheControl(): Promise<void> {
    return FeedRequestGuardTests.withGuardAsync("https://updates.example.test/", guard => {
      const headers = guard.headersOf({
        "User-Agent": "electron-builder", Accept: "*/*", Cookie: "id=1", referer: "https://app.example.test/", Authorization: "Bearer x",
        "Accept-Language": "fr-FR", range: "bytes=0-99", "Cache-Control": "no-cache", "X-Unknown-Header": "1"
      }, false);

      Assert.areEqual(JSON.stringify({ Accept: "*/*", range: "bytes=0-99", "Cache-Control": "no-cache", "User-Agent": FeedRequestGuardTests.USER_AGENT }),
        JSON.stringify(headers));
      Assert.areEqual(JSON.stringify({ "User-Agent": FeedRequestGuardTests.DAILY_USER_AGENT }), JSON.stringify(guard.headersOf({}, true)));
      return Promise.resolve();
    });
  }

  @TestMethod
  public cancelsARequestElsewhereLoggingItsHostAloneAndMarksOnlyTheDaysFirstRequest(): Promise<void> {
    const lines: string[] = [];
    return FeedRequestGuardTests.withGuardAsync("https://updates.example.test/", async guard => {
      const answers: string[] = [];
      const checks: Parameters<IFeedWebRequest["onBeforeRequest"]>[0][] = [];
      const sends: Parameters<IFeedWebRequest["onBeforeSendHeaders"]>[0][] = [];
      guard.install({
        onBeforeRequest: t => {
          checks.push(t);
        },
        onBeforeSendHeaders: t => {
          sends.push(t);
        },
        onResponseStarted: () => undefined,
        onErrorOccurred: () => undefined
      });

      for (const url of ["https://updates.example.test/latest-linux-x64.yml", "https://evil.example.test/a/b?token=secret", "not a url"])
        checks.forEach(check => check({ url }, t => answers.push(`${url} ${t.cancel ? "cancelled" : "sent"}`)));
      const sent = sends.flatMap(send => [1, 2].map(id => new Promise<string>(resolve => send({ id, requestHeaders: { Cookie: "id=1" } }, t => resolve(JSON.stringify(t.requestHeaders))))));

      Assert.areEqual([
        "https://updates.example.test/latest-linux-x64.yml sent",
        "https://evil.example.test/a/b?token=secret cancelled",
        "not a url cancelled"
      ].join("\n"), answers.join("\n"));
      Assert.areEqual([
        "An update request to evil.example.test was cancelled: it is neither the feed's host nor GitHub's release asset host.",
        "An update request to an invalid address was cancelled: it is neither the feed's host nor GitHub's release asset host."
      ].join("\n"), lines.join("\n"));
      Assert.areEqual([JSON.stringify({ "User-Agent": FeedRequestGuardTests.DAILY_USER_AGENT }), JSON.stringify({ "User-Agent": FeedRequestGuardTests.USER_AGENT })].join("\n"),
        (await Promise.all(sent)).join("\n"));
    }, t => lines.push(t));
  }

  @TestMethod
  public recordsTheDaysMarkOnceItsRequestIsAnsweredAndReleasesItWhenTheRequestFails(): Promise<void> {
    return FeedRequestGuardTests.withGuardAsync("https://updates.example.test/", async (guard, file) => {
      let send: Parameters<IFeedWebRequest["onBeforeSendHeaders"]>[0] = () => undefined;
      let started: Parameters<IFeedWebRequest["onResponseStarted"]>[0] = () => undefined;
      let failed: Parameters<IFeedWebRequest["onErrorOccurred"]>[0] = () => undefined;
      guard.install({
        onBeforeRequest: () => undefined,
        onBeforeSendHeaders: t => {
          send = t;
        },
        onResponseStarted: t => {
          started = t;
        },
        onErrorOccurred: t => {
          failed = t;
        }
      });
      const userAgentOf = (id: number): Promise<string | undefined> => new Promise(resolve => send({ id, requestHeaders: {} }, t => resolve(t.requestHeaders["User-Agent"])));
      const isWritten = (): Promise<boolean> => access(file).then(() => true, () => false);

      const offline = await userAgentOf(1);
      failed({ id: 2 });
      failed({ id: 1 });
      const afterFailure = await isWritten();
      const retried = await userAgentOf(3);
      started({ id: 4 });
      const beforeAnswer = await userAgentOf(5);
      const unanswered = await isWritten();
      started({ id: 3 });
      failed({ id: 3 });
      const later = await userAgentOf(6);

      Assert.areEqual([FeedRequestGuardTests.DAILY_USER_AGENT, "false", FeedRequestGuardTests.DAILY_USER_AGENT, FeedRequestGuardTests.USER_AGENT, "false",
        FeedRequestGuardTests.USER_AGENT].join("\n"), [offline, afterFailure, retried, beforeAnswer, unanswered, later].join("\n"));
      Assert.areEqual("2026-11-08", await readFile(file, "utf8"));
    });
  }

  private static async withGuardAsync(feed: string, test: (guard: FeedRequestGuard, file: string) => Promise<void>, log: (text: string) => void = () => undefined): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "feed-request-guard-"));
    try {
      const file = join(folder, "last-daily-update-check");
      const mark = new DailyCheckMark(file, () => new Date(2026, 10, 8, 9), log);
      await test(new FeedRequestGuard(feed, FeedRequestGuardTests.PRODUCT, mark, log), file);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
