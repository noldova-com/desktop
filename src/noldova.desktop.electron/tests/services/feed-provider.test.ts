/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { createServer, type RequestListener } from "node:http";

import type { UpdateInfo } from "electron-updater";
import { ElectronHttpExecutor } from "electron-updater/out/electronHttpExecutor.js";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  FeedProvider, FeedSource, type IFeedResponse, UpdateFeedRedirectedException, UpdateFeedRefusedException, UpdateFeedUnreachableException, UpdateInfoInvalidException
} from "@noldova/desktop.electron";

@TestClass
export class FeedProviderTests {
  private static readonly FEED: string = "https://github.test/noldova/desktop/releases/latest/download/";
  private static readonly RELEASE: string = "https://objects.github.test/releases/v1.3.0/latest-linux-x64.yml";
  private static readonly OPTIONS: ConstructorParameters<typeof FeedProvider>[2] = { isUseMultipleRangeRequest: false, platform: "linux", executor: new ElectronHttpExecutor() };
  private static readonly INFO: string = [
    "version: 1.3.0",
    "files:",
    "  - url: Noldova Desktop Sample-1.3.0-linux-x64.AppImage",
    "    sha512: c2hh",
    "    size: 1024",
    "path: Noldova Desktop Sample-1.3.0-linux-x64.AppImage",
    "sha512: c2hh",
    "releaseDate: '2026-10-06T00:00:00.000Z'"
  ].join("\n");

  @TestMethod
  public readsTheTargetsInformationAndGivesItsPackageFromTheReleaseThatAnswered(): Promise<void> {
    return FeedProviderTests.withAnswerAsync({ ok: true, status: 200, url: FeedProviderTests.RELEASE, text: () => Promise.resolve(FeedProviderTests.INFO) }, async (provider, requested) => {
      const info = await provider.getLatestVersion();
      const files = provider.resolveFiles(info);

      Assert.areEqual(JSON.stringify([`${FeedProviderTests.FEED}latest-linux-x64.yml`]), JSON.stringify(requested));
      Assert.areEqual("1.3.0", info.version);
      Assert.areEqual(1, files.length);
      Assert.areEqual("https://objects.github.test/releases/v1.3.0/Noldova%20Desktop%20Sample-1.3.0-linux-x64.AppImage", files[0]?.url.href);
      Assert.areEqual("c2hh", files[0]?.info.sha512);
    });
  }

  @TestMethod
  public resolvesThePackageAgainstTheFeedWhenTheResponseNamesNoUrl(): Promise<void> {
    return FeedProviderTests.withAnswerAsync({ ok: true, status: 200, url: String.empty, text: () => Promise.resolve(FeedProviderTests.INFO) }, async provider => {
      const files = provider.resolveFiles(await provider.getLatestVersion());

      Assert.areEqual(`${FeedProviderTests.FEED}Noldova%20Desktop%20Sample-1.3.0-linux-x64.AppImage`, files[0]?.url.href);
    });
  }

  @TestMethod
  public async saysTheFeedIsUnreachableWhenTheFetchFails(): Promise<void> {
    const cause = new Error("net::ERR_NAME_NOT_RESOLVED");
    const source = new FeedSource(FeedProviderTests.FEED, "latest-linux-x64.yml", "Noldova Desktop Sample-linux-x64.AppImage", () => Promise.reject(cause));
    const provider = new FeedProvider({ source }, null, FeedProviderTests.OPTIONS);

    const failure = await Assert.throwsAsync(() => provider.getLatestVersion(), UpdateFeedUnreachableException);

    Assert.areEqual("Noldova Desktop Sample couldn't reach its update feed.", failure.message);
    Assert.areEqual(cause, failure.cause);
  }

  @TestMethod
  public async givesUpOnAFeedThatDoesNotAnswerInTime(): Promise<void> {
    const signals: unknown[] = [];
    const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    const source = new FeedSource(FeedProviderTests.FEED, "latest-linux-x64.yml", "Noldova Desktop Sample-linux-x64.AppImage", (_, signal) => {
      signals.push(signal);
      return Promise.reject(timeout);
    });
    const provider = new FeedProvider({ source }, null, FeedProviderTests.OPTIONS);

    const failure = await Assert.throwsAsync(() => provider.getLatestVersion(), UpdateFeedUnreachableException);

    Assert.areEqual("Noldova Desktop Sample couldn't reach its update feed.", failure.message);
    Assert.areEqual(timeout, failure.cause);
    Assert.isTrue(signals[0] instanceof AbortSignal);
    Assert.isTrue(signals[0] instanceof AbortSignal && !signals[0].aborted);
  }

  @TestMethod
  public endsAFetchOfAFeedThatNeverAnswersWhenTheTimeoutsSignalAborts(): Promise<void> {
    const controller = new AbortController();
    const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    const timeouts: number[] = [];
    return FeedProviderTests.withFeedServerAsync(() => controller.abort(timeout), async feed => {
      const source = new FeedSource(feed, "latest-linux-x64.yml", "Noldova Desktop Sample-linux-x64.AppImage", (url, signal) => fetch(url, { signal }),
        milliseconds => FeedProviderTests.record(timeouts, milliseconds, controller.signal));
      const provider = new FeedProvider({ source }, null, FeedProviderTests.OPTIONS);

      const failure = await Assert.throwsAsync(() => provider.getLatestVersion(), UpdateFeedUnreachableException);

      Assert.areEqual("Noldova Desktop Sample couldn't reach its update feed.", failure.message);
      Assert.areEqual(timeout, failure.cause);
      Assert.areEqual("30000", timeouts.join(","));
    });
  }

  @TestMethod
  public endsAFeedsAnswerWhoseBodyStallsWhenTheTimeoutsSignalAborts(): Promise<void> {
    const controller = new AbortController();
    const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    const stall: RequestListener = (_, response) => {
      response.writeHead(200, { "Content-Length": "1024" });
      response.write("version: 1.3.0\n");
    };
    const timeouts: number[] = [];
    return FeedProviderTests.withFeedServerAsync(stall, async feed => {
      const source = new FeedSource(feed, "latest-linux-x64.yml", "Noldova Desktop Sample-linux-x64.AppImage", async (url, signal) => {
        const response = await fetch(url, { signal });
        controller.abort(timeout);
        return response;
      }, milliseconds => FeedProviderTests.record(timeouts, milliseconds, controller.signal));
      const provider = new FeedProvider({ source }, null, FeedProviderTests.OPTIONS);

      const failure = await Assert.throwsAsync(() => provider.getLatestVersion(), UpdateFeedUnreachableException);

      Assert.areEqual("Noldova Desktop Sample couldn't reach its update feed.", failure.message);
      Assert.areEqual(timeout, failure.cause);
      Assert.areEqual("30000", timeouts.join(","));
    });
  }

  @TestMethod
  public saysTheFeedIsUnreachableWhenItsAnswerBreaksOff(): Promise<void> {
    const cause = new Error("terminated");
    return FeedProviderTests.withAnswerAsync({ ok: true, status: 200, url: FeedProviderTests.RELEASE, text: () => Promise.reject(cause) }, async provider => {
      const failure = await Assert.throwsAsync(() => provider.getLatestVersion(), UpdateFeedUnreachableException);

      Assert.areEqual("Noldova Desktop Sample couldn't reach its update feed.", failure.message);
      Assert.areEqual(cause, failure.cause);
    });
  }

  @TestMethod
  public refusesARedirectToAnotherProtocol(): Promise<void> {
    return FeedProviderTests.withAnswerAsync({ ok: true, status: 200, url: "http://objects.github.test/releases/v1.3.0/latest-linux-x64.yml", text: () => Promise.resolve(FeedProviderTests.INFO) }, async provider => {
      Assert.areEqual("The update feed redirected to an address with another protocol.", (await Assert.throwsAsync(() => provider.getLatestVersion(), UpdateFeedRedirectedException)).message);
    });
  }

  @TestMethod
  public saysWhichStatusTheFeedRefusedWith(): Promise<void> {
    return FeedProviderTests.withAnswerAsync({ ok: false, status: 404, url: FeedProviderTests.RELEASE, text: () => Promise.resolve("Not Found") }, async provider => {
      Assert.areEqual("The update feed answered with HTTP status 404.", (await Assert.throwsAsync(() => provider.getLatestVersion(), UpdateFeedRefusedException)).message);
    });
  }

  @TestMethod
  public async refusesInformationThatIsNotYamlOrLacksAVersionFilesOrAWholePackage(): Promise<void> {
    const texts = [
      "version: [1.3.0",
      String.empty,
      "~",
      "version: 1.3.0",
      "version: 13\nfiles: []",
      "version: 1.3.0\nfiles: []",
      "version: 1.3.0\nfiles:\n  - Noldova Desktop Sample-1.3.0-linux-x64.AppImage",
      "version: 1.3.0\nfiles:\n  - url: Noldova Desktop Sample-1.3.0-linux-arm64.AppImage\n    sha512: c2hh\n    size: 1024",
      "version: 1.3.0\nfiles:\n  - url: Noldova Desktop Sample-linux-x64.AppImage\n    sha512: c2hh\n    size: 1024",
      "version: 1.3.0\nfiles:\n  - url: Noldova Desktop Sample-1.2.0-linux-x64.AppImage\n    sha512: c2hh\n    size: 1024",
      "version: 1.3.0\nfiles:\n  - url: Noldova Desktop Sample-1.3.0-linux-x64.AppImage\n    size: 1024",
      "version: 1.3.0\nfiles:\n  - url: Noldova Desktop Sample-1.3.0-linux-x64.AppImage\n    sha512: ''\n    size: 1024",
      "version: 1.3.0\nfiles:\n  - url: Noldova Desktop Sample-1.3.0-linux-x64.AppImage\n    sha512: c2hh\n    size: 10.5",
      "version: 1.3.0\nfiles:\n  - url: Noldova Desktop Sample-1.3.0-linux-x64.AppImage\n    sha512: c2hh\n    size: 0"
    ];

    for (const text of texts)
      await FeedProviderTests.withAnswerAsync({ ok: true, status: 200, url: FeedProviderTests.RELEASE, text: () => Promise.resolve(text) }, async provider => {
        Assert.areEqual("The release's information is invalid.", (await Assert.throwsAsync(() => provider.getLatestVersion(), UpdateInfoInvalidException)).message, text);
      });
  }

  @TestMethod
  public givesNoPackageBeforeAReadOrForInformationWithoutIt(): Promise<void> {
    return FeedProviderTests.withAnswerAsync({ ok: true, status: 200, url: FeedProviderTests.RELEASE, text: () => Promise.resolve(FeedProviderTests.INFO) }, async provider => {
      const other: UpdateInfo = { version: "1.3.0", files: [], path: "Noldova Desktop Sample-1.3.0-linux-x64.AppImage", sha512: "c2hh", releaseDate: "2026-10-06T00:00:00.000Z" };

      const before = Assert.throws(() => provider.resolveFiles(other), UpdateInfoInvalidException);
      await provider.getLatestVersion();

      Assert.areEqual("The release's information is invalid.", before.message);
      Assert.areEqual("The release's information is invalid.", Assert.throws(() => provider.resolveFiles(other), UpdateInfoInvalidException).message);
    });
  }

  @TestMethod
  public refusesOptionsWithoutASource(): void {
    Assert.areEqual("source", Assert.throws(() => new FeedProvider({ source: "https://example.test/" }, null, FeedProviderTests.OPTIONS), ArgumentException).parameterName);
  }

  @TestMethod
  public refusesRuntimeOptionsWithoutElectronUpdatersExecutor(): void {
    const options = { ...FeedProviderTests.OPTIONS, executor: {} };

    Assert.areEqual("executor", Assert.throws(() => new FeedProvider({}, null, options), ArgumentException).parameterName);
  }

  private static record(timeouts: number[], milliseconds: number, signal: AbortSignal): AbortSignal {
    timeouts.push(milliseconds);
    return signal;
  }

  private static async withFeedServerAsync(listener: RequestListener, run: (feed: string) => Promise<void>): Promise<void> {
    const server = createServer(listener);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const address = server.address();
      if (Object.isNull(address) || Object.isString(address))
        throw new Error("The feed's server has no port.");
      await run(`http://127.0.0.1:${address.port}/`);
    }
    finally {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    }
  }

  private static async withAnswerAsync(response: IFeedResponse, run: (provider: FeedProvider, requested: string[]) => Promise<void>): Promise<void> {
    const requested: string[] = [];
    const source = new FeedSource(FeedProviderTests.FEED, "latest-linux-x64.yml", "Noldova Desktop Sample-linux-x64.AppImage", url => {
      requested.push(url);
      return Promise.resolve(response);
    }, undefined, t => `Noldova Desktop Sample-${t}-linux-x64.AppImage`);
    await run(new FeedProvider({ source }, null, FeedProviderTests.OPTIONS), requested);
  }
}
