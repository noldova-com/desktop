/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { WebViewRefusedPage } from "../../src/models/web-view-refused-page.js";
import { WindowAppearance } from "../../src/models/window-appearance.js";

@TestClass
export class WebViewRefusedPageTests {
  private static readonly DARK: WindowAppearance = new WindowAppearance("#1E1E1E", "#2D2D2D", "#F2F2F2", 32);

  @TestMethod
  public buildsAPageThatRunsNothingInTheWindowsColorsWithTheModulesName(): void {
    const page = new WebViewRefusedPage("Browser", () => WebViewRefusedPageTests.DARK).format("https://other.example.net", "n1");

    Assert.isTrue(page.startsWith("data:text/html;base64,"));
    Assert.areEqual(
      "<!doctype html><html><head><meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'\">" +
      "<meta name=\"color-scheme\" content=\"light dark\"><title>Browser doesn't open https://other.example.net</title>" +
      "<style>body{margin:0;padding:1rem;background:#1E1E1E;color:#F2F2F2;font:0.875rem/1.4 system-ui,sans-serif}" +
      "h1{margin:0 0 0.5rem;font-size:1rem;font-weight:600;overflow-wrap:anywhere}p{margin:0}</style></head>" +
      "<body data-refused=\"n1\"><h1>Browser doesn't open https://other.example.net</h1><p>Its address isn't one Browser opens.</p></body></html>",
      WebViewRefusedPageTests.read(page));
  }

  @TestMethod
  public readsTheWindowsColorsEachTimeAndFallsBackToTheSystemsBeforeTheWindowIsPainted(): void {
    let appearance: WindowAppearance | null = null;
    const refused = new WebViewRefusedPage("Browser", () => appearance);

    const unpainted = WebViewRefusedPageTests.read(refused.format("https://example.net", "n"));
    appearance = new WindowAppearance("#FFFFFF", "#F2F2F2", "#1A1A1A", 32);
    const light = WebViewRefusedPageTests.read(refused.format("https://example.net", "n"));

    Assert.isTrue(unpainted.includes("background:Canvas;color:CanvasText;"));
    Assert.isTrue(light.includes("background:#FFFFFF;color:#1A1A1A;"));
  }

  @TestMethod
  public escapesMarkupInTheNameAndTheAddress(): void {
    const page = WebViewRefusedPageTests.read(new WebViewRefusedPage("<img src=x onerror=\"a()\">&'", () => null).format("data:text/html,<script>a()</script>", "n"));

    Assert.isTrue(page.includes("<h1>&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39; doesn't open data:text/html,&lt;script&gt;a()&lt;/script&gt;</h1>"));
    Assert.isFalse(page.includes("<script>"));
    Assert.isFalse(page.includes("<img"));
  }

  @TestMethod
  @TestData("")
  @TestData("   ")
  @TestData(null)
  @TestData(7)
  public saysThisViewWhenTheWindowSendsNoName(name: unknown): void {
    const page = WebViewRefusedPageTests.read(new WebViewRefusedPage(name, () => null).format("https://example.net", "n"));

    Assert.isTrue(page.includes("<h1>This view doesn't open https://example.net</h1><p>Its address isn't one this view opens.</p>"));
  }

  @TestMethod
  public saysThisAddressWithoutNamingATargetItIsNotGiven(): void {
    const named = WebViewRefusedPageTests.read(new WebViewRefusedPage("Browser", () => null).format(null, "n"));
    const nameless = WebViewRefusedPageTests.read(new WebViewRefusedPage(null, () => null).format(null, "n"));

    Assert.isTrue(named.includes("<title>Browser doesn't open this address</title>"));
    Assert.isTrue(named.includes("<h1>Browser doesn't open this address</h1><p>Its address isn't one Browser opens.</p>"));
    Assert.isTrue(nameless.includes("<h1>This view doesn't open this address</h1><p>Its address isn't one this view opens.</p>"));
  }

  @TestMethod
  public capsTheNameAndTheAddressItShows(): void {
    const page = WebViewRefusedPageTests.read(new WebViewRefusedPage(` ${"N".repeat(70)} `, () => null).format(`https://${"a".repeat(300)}.example`, "n"));

    Assert.isTrue(page.includes(`<h1>${"N".repeat(64)} doesn't open https://${"a".repeat(248)}</h1>`));
  }

  private static read(page: string): string {
    return Buffer.from(page.slice("data:text/html;base64,".length), "base64").toString("utf8");
  }
}
