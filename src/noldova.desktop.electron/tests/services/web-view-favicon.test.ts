/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { mock } from "node:test";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Resources } from "../../src/resources.js";
import { WebViewFavicon } from "../../src/services/web-view-favicon.js";
import { WebViewOriginCheck } from "../../src/services/web-view-origin-check.js";
import { Condition } from "../fixtures/condition.fixture.js";
import { FakeWebViewContents } from "../fixtures/fake-web-view-contents.fixture.js";
import { FakeWebViewSession } from "../fixtures/fake-web-view-session.fixture.js";

class FaviconHarness {
  public static readonly PNG: string = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  public static readonly ICON: string = "https://example.com/favicon.ico";
  public readonly session: FakeWebViewSession = new FakeWebViewSession();
  public readonly contents: FakeWebViewContents = new FakeWebViewContents(7);
  public readonly images: (string | null)[] = [];
  public readonly waits: (() => void)[] = [];
  public readonly favicon: WebViewFavicon;
  public allowed: readonly string[] = ["https://example.com", "https://private.example.com"];

  public constructor() {
    this.favicon = new WebViewFavicon(this.session, new WebViewOriginCheck(), () => this.allowed, (_milliseconds, signal) => new Promise((resolve, reject) => {
      this.waits.push(resolve);
      signal.addEventListener("abort", () => reject(new Error("The wait was aborted.")), { once: true });
    }), t => this.images.push(t));
    this.session.onBeforeRequest((request, callback) => callback({ cancel: !this.favicon.allowsRequest(request.url) }));
    this.session.addresses.set("example.com", ["93.184.215.14"]);
    this.session.addresses.set("private.example.com", ["10.0.0.5"]);
    this.session.icons.set(FaviconHarness.ICON, new Uint8Array([1, 2, 3]));
    this.decodeTo(FaviconHarness.PNG);
  }

  public static png(length: number, width: number = 1, height: number = width, type: string = "IHDR"): string {
    const png = Buffer.alloc(length);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).copy(png);
    png.write(type, 12, "latin1");
    png.writeUInt32BE(width, 16);
    png.writeUInt32BE(height, 20);
    return png.toString("base64");
  }

  public decodeTo(value: unknown): void {
    this.contents.onIsolated = () => Promise.resolve(value);
  }

  public updateAsync(...candidates: string[]): Promise<void> {
    return this.favicon.updateAsync(this.contents, candidates);
  }

  public describe(): string {
    return this.images.map(t => Object.isNull(t) ? "null" : t === `data:image/png;base64,${FaviconHarness.PNG}` ? "png" : `${t.length}`).join(",");
  }
}

@TestClass
export class WebViewFaviconTests {
  @TestMethod
  public async fetchesAnIconInTheViewsProfileUnderItsChecksAndDecodesItInThePagesIsolatedWorld(): Promise<void> {
    const harness = new FaviconHarness();

    await harness.updateAsync(FaviconHarness.ICON);

    Assert.areEqual("png", harness.describe());
    Assert.areEqual(`${FaviconHarness.ICON} allowed`, harness.session.iconReads.join(","));
    Assert.isTrue(harness.contents.isolated[0]?.startsWith("1997 (async () => {") ?? false);
    Assert.isTrue(harness.contents.isolated[0]?.includes("atob(\"AQID\")") ?? false);
    Assert.isFalse(harness.favicon.allowsRequest(FaviconHarness.ICON));
  }

  @TestMethod
  public async reportsAnIconOnlyWhenItChangesAndReadsOneAtAPrivateAddressTheViewAllowsByThatAddress(): Promise<void> {
    const harness = new FaviconHarness();
    harness.allowed = [...harness.allowed, "http://192.168.1.20"];
    harness.session.icons.set("http://192.168.1.20/other.png", new Uint8Array([4, 5, 6]));

    await harness.updateAsync(FaviconHarness.ICON);
    await harness.updateAsync(FaviconHarness.ICON);
    harness.decodeTo(FaviconHarness.png(24));
    await harness.updateAsync("http://192.168.1.20/other.png");

    Assert.areEqual(`png,${"data:image/png;base64,".length + 32}`, harness.describe());
    Assert.areEqual(`${FaviconHarness.ICON} allowed,${FaviconHarness.ICON} allowed,http://192.168.1.20/other.png allowed`, harness.session.iconReads.join(","));
  }

  @TestMethod
  public async letsAnIconsRequestThroughUntilTheLastOfItsReadsEnds(): Promise<void> {
    const harness = new FaviconHarness();
    const [first, second] = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
    harness.session.iconHolds.push(first.promise, second.promise);
    const earlier = harness.updateAsync(FaviconHarness.ICON);
    const later = harness.updateAsync(FaviconHarness.ICON);
    await Condition.waitAsync(() => harness.session.iconReads.length === 2);

    first.resolve();
    await earlier;
    const afterFirst = harness.favicon.allowsRequest(FaviconHarness.ICON);
    second.resolve();
    await later;

    Assert.areEqual("true,false", [afterFirst, harness.favicon.allowsRequest(FaviconHarness.ICON)].join(","));
    Assert.areEqual("png", harness.describe());
  }

  @TestMethod
  public async refusesAnIconFromAnOriginTheViewDoesntAllowOrAPrivateAddressThatIsntALocalEntryOrANameThatDoesntResolveAndReportsNull(): Promise<void> {
    const harness = new FaviconHarness();
    harness.allowed = [...harness.allowed, "https://unknown.example.com"];
    await harness.updateAsync(FaviconHarness.ICON);

    await harness.updateAsync("https://example.net/favicon.ico", "http://127.0.0.1:9000/favicon.ico", "https://private.example.com/favicon.ico", "data:image/png;base64,AQID");
    await harness.updateAsync("https://unknown.example.com/favicon.ico");

    Assert.areEqual("png,null", harness.describe());
    Assert.areEqual(`${FaviconHarness.ICON} allowed`, harness.session.iconReads.join(","));
  }

  @TestMethod
  public async reportsNullForAnIconTooLargeOrThatFailsToLoadOrWhosePngIsOver16Kb(): Promise<void> {
    const harness = new FaviconHarness();
    harness.session.icons.set("https://example.com/broken.ico", new Error("net::ERR_CONNECTION_RESET"));
    harness.session.icons.set("https://example.com/large.ico", new Uint8Array(1_048_577));
    harness.session.icons.set("https://example.com/largest.ico", new Uint8Array(1_048_576));

    await harness.updateAsync(FaviconHarness.ICON);
    await harness.updateAsync("https://example.com/large.ico");
    await harness.updateAsync(FaviconHarness.ICON);
    harness.decodeTo(FaviconHarness.png(16_385));
    await harness.updateAsync("https://example.com/largest.ico");
    harness.decodeTo(FaviconHarness.png(16_384));
    await harness.updateAsync("https://example.com/largest.ico");
    await harness.updateAsync("https://example.com/broken.ico");

    Assert.areEqual(`png,null,png,null,${"data:image/png;base64,".length + 21_848},null`, harness.describe());
  }

  @TestMethod
  public async reportsNullForAnIconThatFailsToDecodeOrWhoseDecodingDoesntEnd(): Promise<void> {
    const harness = new FaviconHarness();
    const failures: (() => Promise<unknown>)[] = [
      () => Promise.resolve(null),
      () => Promise.reject(new Error("The page is gone.")),
      () => Promise.resolve("AQID"),
      () => Promise.resolve("not base64!"),
      () => Promise.resolve(42)
    ];

    for (const failure of failures) {
      harness.decodeTo(FaviconHarness.PNG);
      await harness.updateAsync(FaviconHarness.ICON);
      harness.contents.onIsolated = failure;
      await harness.updateAsync(FaviconHarness.ICON);
    }
    harness.decodeTo(FaviconHarness.PNG);
    await harness.updateAsync(FaviconHarness.ICON);
    harness.contents.onIsolated = () => new Promise(() => undefined);
    const started = harness.waits.length;
    const endless = harness.updateAsync(FaviconHarness.ICON);
    await Condition.waitAsync(() => harness.waits.length === started + 2);
    harness.waits[started + 1]?.();
    await endless;

    Assert.areEqual("png,null,png,null,png,null,png,null,png,null,png,null", harness.describe());
  }

  @TestMethod
  public async takesThePagesNextIconWhenOneCantBeReadAndLooksAtNoMoreThanFour(): Promise<void> {
    const harness = new FaviconHarness();
    harness.session.icons.set("https://example.com/icon.svg", new Uint8Array([7]));
    harness.contents.onIsolated = () => Promise.resolve(harness.contents.isolated.length === 1 ? null : FaviconHarness.PNG);

    await harness.updateAsync("https://example.com/icon.svg", FaviconHarness.ICON);
    harness.images.length = 0;
    await harness.updateAsync("https://example.net/1.ico", "https://example.net/2.ico", "https://example.net/3.ico", "https://example.net/4.ico", FaviconHarness.ICON);

    Assert.areEqual("null", harness.describe());
    Assert.areEqual(`https://example.com/icon.svg allowed,${FaviconHarness.ICON} allowed`, harness.session.iconReads.join(","));
  }

  @TestMethod
  public async reportsNullOnceForAPageThatNamesNoIconByTheTimeItStopsLoading(): Promise<void> {
    const harness = new FaviconHarness();
    await harness.updateAsync(FaviconHarness.ICON);

    harness.favicon.noteNavigation();
    harness.favicon.noteStop();
    harness.favicon.noteStop();
    harness.favicon.noteNavigation();
    await harness.updateAsync(FaviconHarness.ICON);
    harness.favicon.noteStop();

    Assert.areEqual("png,null,png", harness.describe());
  }

  @TestMethod
  public async keepsOnlyTheIconThePageNamedLastWhenItChangesItDuringARead(): Promise<void> {
    const harness = new FaviconHarness();
    const first = Promise.withResolvers<unknown>();
    harness.contents.onIsolated = () => first.promise;
    const earlier = harness.updateAsync(FaviconHarness.ICON);
    await Condition.waitAsync(() => harness.contents.isolated.length === 1);

    harness.decodeTo(FaviconHarness.png(24));
    await harness.updateAsync(FaviconHarness.ICON);
    first.resolve(FaviconHarness.PNG);
    await earlier;

    Assert.areEqual(`${"data:image/png;base64,".length + 32}`, harness.describe());
  }

  @TestMethod
  public async stopsTheReadUnderWayWhenThePageNavigatesNamesAnotherIconStopsLoadingUnnamedOrTheViewCloses(): Promise<void> {
    const harness = new FaviconHarness();
    const stops: (() => Promise<void> | void)[] = [
      () => harness.favicon.noteNavigation(),
      () => harness.updateAsync("https://example.com/other.ico"),
      () => {
        harness.favicon.noteNavigation();
        harness.favicon.noteStop();
      },
      () => harness.favicon.close()
    ];

    for (const stop of stops) {
      harness.session.iconHolds.push(new Promise(() => undefined));
      const started = harness.session.iconSignals.length;
      const read = harness.updateAsync(FaviconHarness.ICON);
      await Condition.waitAsync(() => harness.session.iconSignals.length === started + 1);
      await stop();
      await read;
    }

    Assert.areEqual("true,true,true,true", [0, 1, 3, 4].map(t => harness.session.iconSignals[t]?.aborted).join(","));
    Assert.areEqual(0, harness.contents.isolated.length);
    Assert.areEqual(String.empty, harness.describe());
  }

  @TestMethod
  public async dropsAnIconReadForAPageItHasLeftThoughTheReadEndsBeforeTheNextPageNamesItsIcon(): Promise<void> {
    const harness = new FaviconHarness();
    const held = Promise.withResolvers<void>();
    harness.session.ignoresIconAborts = true;
    harness.session.iconHolds.push(held.promise);
    const read = harness.updateAsync(FaviconHarness.ICON);
    await Condition.waitAsync(() => harness.session.iconReads.length === 1);

    harness.favicon.noteNavigation();
    held.resolve();
    await read;

    Assert.areEqual(0, harness.contents.isolated.length);
    Assert.areEqual(String.empty, harness.describe());
  }

  @TestMethod
  public async stopsAnIconReadThatDoesntEndByItsDeadlineAndTakesThePagesNextIcon(): Promise<void> {
    const harness = new FaviconHarness();
    harness.session.icons.set("https://example.com/slow.ico", new Uint8Array([9]));
    harness.session.iconHolds.push(new Promise(() => undefined));
    const read = harness.updateAsync("https://example.com/slow.ico", FaviconHarness.ICON);
    await Condition.waitAsync(() => harness.waits.length === 1 && harness.session.iconReads.length === 1);

    harness.waits[0]?.();
    await read;

    Assert.areEqual("true,false", harness.session.iconSignals.map(t => t.aborted).join(","));
    Assert.areEqual("png", harness.describe());
  }

  @TestMethod
  public async refusesADecodedPngThatIsntAPngOfOneTo64PixelsASideBeforeReadingItsHeader(): Promise<void> {
    const harness = new FaviconHarness();
    const values = [FaviconHarness.png(24, 65), FaviconHarness.png(24, 64, 65), FaviconHarness.png(24, 0, 1), FaviconHarness.png(24, 1, 0),
      FaviconHarness.png(24, 1, 1, "IDAT"), FaviconHarness.png(24).slice(0, 28), Buffer.alloc(24).toString("base64"), "A".repeat(21_849)];
    const testing = mock.method(Resources.faviconBase64Pattern, "test");
    try {
      for (const value of values) {
        harness.decodeTo(FaviconHarness.png(24, 64));
        await harness.updateAsync(FaviconHarness.ICON);
        harness.decodeTo(value);
        await harness.updateAsync(FaviconHarness.ICON);
      }
    }
    finally {
      testing.mock.restore();
    }
    const tested = testing.mock.calls.map(t => t.arguments[0]);

    Assert.areEqual(Array(values.length).fill(`${"data:image/png;base64,".length + 32},null`).join(","), harness.describe());
    Assert.isFalse(tested.includes(values[values.length - 1] ?? String.empty));
    Assert.areEqual(values.length * 2 - 1, tested.length);
  }
}
