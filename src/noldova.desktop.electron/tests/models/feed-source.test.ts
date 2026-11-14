/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { FeedSource, type IFeedResponse } from "@noldova/desktop.electron";

@TestClass
export class FeedSourceTests {
  private static readonly FEED: string = "https://example.test/releases/latest/download/";

  @TestMethod
  public namesTheFilesOfEachPlatformAndProcessor(): void {
    const fetchAsync = (): Promise<IFeedResponse> => Promise.reject(new Error("offline"));
    const files = [["win32", "x64"], ["darwin", "arm64"], ["linux", "x64"], ["linux", "arm64"]].map(([platform, architecture]) => {
      const source = FeedSource.create(FeedSourceTests.FEED, "Noldova Desktop Sample", String(platform), String(architecture), fetchAsync);
      return [source?.feed, source?.channelFile, source?.packageFile, source?.fetchAsync === fetchAsync];
    });

    Assert.areEqual(JSON.stringify([
      [FeedSourceTests.FEED, "latest-windows-x64.yml", "Noldova Desktop Sample-windows-x64.exe", true],
      [FeedSourceTests.FEED, "latest-macos-arm64.yml", "Noldova Desktop Sample-macos-arm64.zip", true],
      [FeedSourceTests.FEED, "latest-linux-x64.yml", "Noldova Desktop Sample-linux-x64.AppImage", true],
      [FeedSourceTests.FEED, "latest-linux-arm64.yml", "Noldova Desktop Sample-linux-arm64.AppImage", true]
    ]), JSON.stringify(files));
  }

  @TestMethod
  public namesTheDebianPackageOnLinuxForACopyInstalledFromIt(): void {
    const fetchAsync = (): Promise<IFeedResponse> => Promise.reject(new Error("offline"));
    const files = [["linux", "x64"], ["linux", "arm64"], ["win32", "x64"], ["darwin", "arm64"]].map(([platform, architecture]) =>
      FeedSource.create(FeedSourceTests.FEED, "Noldova Desktop Sample", String(platform), String(architecture), fetchAsync, true)?.packageFile);

    Assert.areEqual(JSON.stringify([
      "Noldova Desktop Sample-linux-x64.deb", "Noldova Desktop Sample-linux-arm64.deb", "Noldova Desktop Sample-windows-x64.exe", "Noldova Desktop Sample-macos-arm64.zip"
    ]), JSON.stringify(files));
  }

  @TestMethod
  public hasNoSourceWithoutAFeedOrForATargetWithoutPackages(): void {
    const fetchAsync = (): Promise<IFeedResponse> => Promise.reject(new Error("offline"));

    Assert.isNull(FeedSource.create(null, "Noldova Desktop Sample", "linux", "x64", fetchAsync));
    Assert.isNull(FeedSource.create(FeedSourceTests.FEED, "Noldova Desktop Sample", "freebsd", "x64", fetchAsync));
    Assert.isNull(FeedSource.create(FeedSourceTests.FEED, "Noldova Desktop Sample", "linux", "ia32", fetchAsync));
  }

  @TestMethod
  public abortsAFetchWithTheTimeoutItIsGivenOrWithAbortSignalsOwn(): void {
    const fetchAsync = (): Promise<IFeedResponse> => Promise.reject(new Error("offline"));
    const controller = new AbortController();
    const asked: number[] = [];
    const given = new FeedSource(FeedSourceTests.FEED, "latest-linux-x64.yml", "Noldova Desktop Sample-linux-x64.AppImage", fetchAsync, t => {
      asked.push(t);
      return controller.signal;
    });
    const standard = new FeedSource(FeedSourceTests.FEED, "latest-linux-x64.yml", "Noldova Desktop Sample-linux-x64.AppImage", fetchAsync);

    Assert.areEqual(controller.signal, given.timeout(30_000));
    Assert.areEqual("30000", asked.join(","));
    const signal = standard.timeout(60_000);
    Assert.isTrue(signal !== controller.signal && !signal.aborted);
  }
}
