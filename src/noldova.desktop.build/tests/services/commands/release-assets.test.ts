/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { Resources } from "../../../src/resources.js";
import { ReleaseAssets } from "../../../src/services/commands/release-assets.js";
import { InstalledAppFixture } from "../../fixtures/installed-app.fixture.js";

@TestClass
export class ReleaseAssetsTests {
  private static readonly FEED: string = "http://127.0.0.1:47325/";
  private static readonly OTHER_FEED: string = "http://127.0.0.1:47326/";
  private static readonly PRODUCT_FEED: string = "https://github.com/example/sample-app/releases/latest/download/";
  private static readonly INTERNAL_FEED: string = "https://updates.example.test/sample-app/";
  private static readonly OWN_FEED: string = "https://counted.example.test/";
  private static readonly USAGE: string = "2 Usage: noldova-desktop-build release-assets [--update-feed <https URL, or http URL of localhost, ending in />]\n";
  private static readonly WRITTEN: string = "0 The release files of linux x64 for 1.2.3:\nSample App-linux-x64.AppImage\nSample App-linux-x64.deb\nSample App-linux-x64.AppImage.sha256\nSample App-linux-x64.deb.sha256\nlatest-linux-x64.yml\n";
  private static readonly PRODUCT_FILE: string = "_build/package/app/_build/product.json";
  private static readonly PACKAGE_FILE: string = "_build/package/out/Sample App-linux-x64.AppImage";
  private static readonly DEBIAN_FILE: string = "_build/package/out/Sample App-linux-x64.deb";

  @TestMethod
  public async writesTheReleaseFilesOfAPackageForATestFeedOnlyWhenGivenThatFeedAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    await app.writeAppFileAsync(ReleaseAssetsTests.PRODUCT_FILE, JSON.stringify({ updateFeed: ReleaseAssetsTests.FEED }));
    await app.writeAppFileAsync(ReleaseAssetsTests.PACKAGE_FILE, "package");
    await app.writeAppFileAsync(ReleaseAssetsTests.DEBIAN_FILE, "debian package");

    const ownFeed = await app.runAsync("linux", ["release-assets"]);
    const otherFeed = await app.runAsync("linux", ["release-assets", "--update-feed", ReleaseAssetsTests.OTHER_FEED]);
    const invalid = await app.runAsync("linux", ["release-assets", "--update-feed", "ftp://127.0.0.1/"]);
    const secure = await app.runAsync("linux", ["release-assets", "--update-feed", ReleaseAssetsTests.PRODUCT_FEED]);
    const missing = await app.runAsync("linux", ["release-assets", "--update-feed"]);
    const testFeed = await app.runAsync("linux", ["release-assets", "--update-feed", ReleaseAssetsTests.FEED]);

    Assert.areEqual(`1 The packaged product file names the update feed "${ReleaseAssetsTests.FEED}", not ${ReleaseAssetsTests.PRODUCT_FEED}, so its packages cannot be released.\n`, ownFeed);
    Assert.areEqual(`1 The packaged product file names the update feed "${ReleaseAssetsTests.FEED}", not ${ReleaseAssetsTests.OTHER_FEED}, so its packages cannot be released.\n`, otherFeed);
    Assert.areEqual(ReleaseAssetsTests.USAGE, invalid);
    Assert.areEqual(`1 The packaged product file names the update feed "${ReleaseAssetsTests.FEED}", not ${ReleaseAssetsTests.PRODUCT_FEED}, so its packages cannot be released.\n`, secure);
    Assert.areEqual(ReleaseAssetsTests.USAGE, missing);
    Assert.areEqual(ReleaseAssetsTests.WRITTEN, testFeed);
    Assert.isTrue(existsSync(path.join(app.path, "_build", "package", "out", "latest-linux-x64.yml")));
  }

  @TestMethod
  public async writesTheReleaseFilesOfAPackageForAnInternalFeedOnlyWhenGivenThatFeedAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    await app.writeAppFileAsync(ReleaseAssetsTests.PRODUCT_FILE, JSON.stringify({ updateFeed: ReleaseAssetsTests.INTERNAL_FEED }));
    await app.writeAppFileAsync(ReleaseAssetsTests.PACKAGE_FILE, "package");
    await app.writeAppFileAsync(ReleaseAssetsTests.DEBIAN_FILE, "debian package");

    const ownFeed = await app.runAsync("linux", ["release-assets"]);
    const plain = await app.runAsync("linux", ["release-assets", "--update-feed", "http://updates.example.test/sample-app/"]);
    const internal = await app.runAsync("linux", ["release-assets", "--update-feed", ReleaseAssetsTests.INTERNAL_FEED]);

    Assert.areEqual(`1 The packaged product file names the update feed "${ReleaseAssetsTests.INTERNAL_FEED}", not ${ReleaseAssetsTests.PRODUCT_FEED}, so its packages cannot be released.\n`, ownFeed);
    Assert.areEqual(ReleaseAssetsTests.USAGE, plain);
    Assert.areEqual(ReleaseAssetsTests.WRITTEN, internal);
  }

  @TestMethod
  public async writesTheReleaseFilesOfAPackageForTheAppsOwnFeedAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync({ updateFeed: ReleaseAssetsTests.OWN_FEED });
    await app.writeAppFileAsync(ReleaseAssetsTests.PACKAGE_FILE, "package");
    await app.writeAppFileAsync(ReleaseAssetsTests.DEBIAN_FILE, "debian package");
    await app.writeAppFileAsync(ReleaseAssetsTests.PRODUCT_FILE, JSON.stringify({ updateFeed: ReleaseAssetsTests.PRODUCT_FEED }));
    const repositoryFeed = await app.runAsync("linux", ["release-assets"]);
    await app.writeAppFileAsync(ReleaseAssetsTests.PRODUCT_FILE, JSON.stringify({ updateFeed: ReleaseAssetsTests.OWN_FEED }));
    const ownFeed = await app.runAsync("linux", ["release-assets"]);

    Assert.areEqual(`1 The packaged product file names the update feed "${ReleaseAssetsTests.PRODUCT_FEED}", not ${ReleaseAssetsTests.OWN_FEED}, so its packages cannot be released.\n`, repositoryFeed);
    Assert.areEqual(ReleaseAssetsTests.WRITTEN, ownFeed);
  }

  @TestMethod
  public async answersAnotherOptionOrAnExtraArgumentWithItsUsageAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();

    const other = await app.runAsync("linux", ["release-assets", "--feed", ReleaseAssetsTests.FEED]);
    const extra = await app.runAsync("linux", ["release-assets", "--update-feed", ReleaseAssetsTests.FEED, "now"]);

    Assert.areEqual(ReleaseAssetsTests.USAGE, other);
    Assert.areEqual(ReleaseAssetsTests.USAGE, extra);
  }

  @TestMethod
  public async refusesAPackagedProductFileItCannotReadOrThatNamesNoFeedAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    await app.writeAppFileAsync(ReleaseAssetsTests.PACKAGE_FILE, "package");
    await app.writeAppFileAsync(ReleaseAssetsTests.DEBIAN_FILE, "debian package");
    const file = path.join(app.path, ...ReleaseAssetsTests.PRODUCT_FILE.split("/"));

    const missing = await ReleaseAssetsTests.runAsync(app);
    await app.writeAppFileAsync(ReleaseAssetsTests.PRODUCT_FILE, "{");
    const broken = await ReleaseAssetsTests.runAsync(app);
    await app.writeAppFileAsync(ReleaseAssetsTests.PRODUCT_FILE, "{}");
    const unnamed = await ReleaseAssetsTests.runAsync(app);

    Assert.isTrue(missing.startsWith(`1 The packaged product file ${file} could not be read as JSON, so its update feed is unknown: `), missing);
    Assert.isTrue(broken.startsWith(`1 The packaged product file ${file} could not be read as JSON, so its update feed is unknown: `), broken);
    Assert.areEqual(`1 The packaged product file names the update feed null, not ${ReleaseAssetsTests.PRODUCT_FEED}, so its packages cannot be released.\n`, unnamed);
  }

  @TestMethod
  public async refusesAPlatformItDoesNotPackageAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const output = new PassThrough();

    const exitCode = await new ReleaseAssets(app.path, "aix", "x64", output).runAsync([]);

    Assert.areEqual(1, exitCode);
    Assert.areEqual("Packages are made for windows, macos and linux on x64 and arm64, not for aix on x64.\n", output.read()?.toString() ?? String.empty);
  }

  @TestMethod
  public async refusesAFolderWithoutARootManifestAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const output = new PassThrough();

    const exitCode = await new ReleaseAssets(path.join(app.path, "missing"), "linux", "x64", output).runAsync([]);

    Assert.areEqual(1, exitCode);
    Assert.areEqual(`${Resources.rootVersionInvalid}\n`, output.read()?.toString() ?? String.empty);
  }

  @TestMethod
  public async throwsAFailureThatIsNotTheReleasesOwnAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    await app.writeAppFileAsync(ReleaseAssetsTests.PRODUCT_FILE, JSON.stringify({ updateFeed: ReleaseAssetsTests.PRODUCT_FEED }));
    await app.writeAppFileAsync(ReleaseAssetsTests.PACKAGE_FILE, "package");
    await app.writeAppFileAsync(ReleaseAssetsTests.DEBIAN_FILE, "debian package");
    await mkdir(path.join(app.path, ...`${ReleaseAssetsTests.PACKAGE_FILE}.sha256`.split("/")), { recursive: true });

    const error = await Assert.throwsAsync(() => new ReleaseAssets(app.path, "linux", "x64", new PassThrough()).runAsync([]), Error);

    Assert.isFalse(error instanceof BuildException, error.message);
  }

  private static async runAsync(app: InstalledAppFixture): Promise<string> {
    return await app.runAsync("linux", ["release-assets"]);
  }
}
