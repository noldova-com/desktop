/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { WebAddressKind, WebViewOriginCheck } from "@noldova/desktop.electron";

@TestClass
export class WebViewOriginCheckTests {
  private static readonly ALLOWED: readonly string[] = ["https://example.com", "https://*.example.org", "http://localhost:4200", "http://192.168.1.2:8080", "https://local.test"];

  @TestMethod
  @TestData("93.184.216.34", WebAddressKind.Public)
  @TestData("127.0.0.1", WebAddressKind.Loopback)
  @TestData("127.9.9.9", WebAddressKind.Loopback)
  @TestData("::1", WebAddressKind.Loopback)
  @TestData("[::1]", WebAddressKind.Loopback)
  @TestData("10.1.2.3", WebAddressKind.Private)
  @TestData("172.16.0.1", WebAddressKind.Private)
  @TestData("172.32.0.1", WebAddressKind.Public)
  @TestData("192.168.0.1", WebAddressKind.Private)
  @TestData("100.64.0.1", WebAddressKind.Private)
  @TestData("100.128.0.1", WebAddressKind.Public)
  @TestData("fc00::1", WebAddressKind.Private)
  @TestData("fd12:3456::1", WebAddressKind.Private)
  @TestData("169.254.169.254", WebAddressKind.LinkLocal)
  @TestData("fe80::1%eth0", WebAddressKind.LinkLocal)
  @TestData("0.0.0.0", WebAddressKind.Unspecified)
  @TestData("0.1.2.3", WebAddressKind.Unspecified)
  @TestData("::", WebAddressKind.Unspecified)
  @TestData("::ffff:7f00:1", WebAddressKind.Loopback)
  @TestData("::ffff:169.254.169.254", WebAddressKind.LinkLocal)
  @TestData("::ffff:a9fe:a9fe", WebAddressKind.LinkLocal)
  @TestData("::c0a8:101", WebAddressKind.Private)
  @TestData("64:ff9b::a00:1", WebAddressKind.Private)
  @TestData("2606:4700::1111", WebAddressKind.Public)
  public classifiesEveryAddressForm(address: string, kind: WebAddressKind): void {
    Assert.areEqual(kind, WebViewOriginCheck.classify(address));
  }

  @TestMethod
  public refusesToClassifyAName(): void {
    Assert.throws(() => WebViewOriginCheck.classify("example.com"), ArgumentException);
  }

  @TestMethod
  @TestData("https://example.com", true)
  @TestData("http://localhost:4200", true)
  @TestData("https://*.example.com", true)
  @TestData("https://*.example.com:8443", true)
  @TestData("https://example.com/", false)
  @TestData("https://Example.com", false)
  @TestData("https://example.com:443", false)
  @TestData("ws://example.com", false)
  @TestData("file:///etc", false)
  @TestData("https://*.127.0.0.1", false)
  @TestData("https://user@example.com", false)
  @TestData("example.com", false)
  public readsOnlyAnOriginOrAWildcardOriginAsAnEntry(text: string, isEntry: boolean): void {
    Assert.areEqual(isEntry, WebViewOriginCheck.isEntry(text));
  }

  @TestMethod
  @TestData("https://example.com/a.png", true)
  @TestData("https://cdn.example.net/a.js", true)
  @TestData("data:image/png;base64,AA==", true)
  @TestData("blob:https://example.com/1", true)
  @TestData("http://localhost:4200/api", true)
  @TestData("http://localhost:4201/api", false)
  @TestData("http://127.0.0.1:4200/", false)
  @TestData("http://app.localhost:4200/", false)
  @TestData("http://localhost.:4200/", false)
  @TestData("http://[::ffff:127.0.0.1]/", false)
  @TestData("http://192.168.1.2:8080/a", true)
  @TestData("http://192.168.1.1/a.png", false)
  @TestData("http://169.254.169.254/latest", false)
  @TestData("http://[fe80::1]/", false)
  @TestData("http://0.0.0.0:4200/", false)
  @TestData("http://[::]:4200/", false)
  @TestData("https://user:secret@example.com/", false)
  @TestData("file:///etc/hosts", false)
  @TestData("devtools://devtools/bundled/inspector.html", false)
  @TestData("chrome://settings", false)
  @TestData("noldova-desktop://open", false)
  @TestData("wss://example.com/socket", true)
  @TestData("wss://a.example.org/socket", true)
  @TestData("wss://cdn.example.net/socket", false)
  @TestData("ws://localhost:4200/hmr", true)
  @TestData("ws://localhost:4300/hmr", false)
  @TestData("not a url", false)
  public runsTheAddressChecksOnEveryRequest(url: string, isAllowed: boolean): void {
    Assert.areEqual(isAllowed, new WebViewOriginCheck().allowsRequest(url, WebViewOriginCheckTests.ALLOWED));
  }

  @TestMethod
  public refusesAnOverlongAddressAndTheAppsOwnEndpointsEvenWhenAllowed(): void {
    const check = new WebViewOriginCheck([], [4600]);
    const allowed = ["http://127.0.0.1:4600", "http://localhost:4600", "https://example.com"];

    Assert.isFalse(check.allowsRequest("http://127.0.0.1:4600/", allowed));
    Assert.isFalse(check.allowsRequest("ws://localhost:4600/", allowed));
    Assert.isFalse(check.allowsNavigation("http://127.0.0.1:4600/", allowed, false));
    Assert.isTrue(check.allowsRequest(`https://example.com/${"a".repeat(32768 - 20)}`, allowed));
    Assert.isFalse(check.allowsRequest(`https://example.com/${"a".repeat(32768 - 19)}`, allowed));
    Assert.isTrue(WebViewOriginCheck.isEntry(`https://${"ab.".repeat(10919)}com`));
    Assert.isFalse(WebViewOriginCheck.isEntry(`https://${"ab.".repeat(10919)}coms`));
  }

  @TestMethod
  @TestData("https://example.com/page", false, true)
  @TestData("https://example.com:443/page", false, true)
  @TestData("http://example.com/page", false, false)
  @TestData("https://example.com:8443/page", false, false)
  @TestData("https://www.example.com/", false, false)
  @TestData("https://a.example.org/", false, true)
  @TestData("https://a.b.example.org/", false, true)
  @TestData("https://example.org/", false, false)
  @TestData("https://badexample.org/", false, false)
  @TestData("https://a.example.org./", false, false)
  @TestData("http://localhost:4200/", false, true)
  @TestData("about:blank", false, true)
  @TestData("about:srcdoc", false, false)
  @TestData("about:srcdoc", true, true)
  @TestData("data:text/html,<p>hi</p>", true, false)
  @TestData("blob:https://example.com/1", true, false)
  @TestData("javascript:alert(1)", false, false)
  @TestData("view-source:https://example.com/", false, false)
  @TestData("https://example.net/", true, false)
  public runsTheNavigationChecksOnEveryPageAndFrame(url: string, isFrame: boolean, isAllowed: boolean): void {
    Assert.areEqual(isAllowed, new WebViewOriginCheck().allowsNavigation(url, WebViewOriginCheckTests.ALLOWED, isFrame));
  }

  @TestMethod
  @TestData("https://example.com/", "93.184.216.34", true)
  @TestData("https://example.com/", "127.0.0.1", false)
  @TestData("https://example.com/", "192.168.1.5", false)
  @TestData("https://example.com/", "::ffff:7f00:1", false)
  @TestData("https://example.com/", "169.254.169.254", false)
  @TestData("https://example.com/", "not an address", false)
  @TestData("http://localhost:4200/", "127.0.0.1", true)
  @TestData("http://localhost:4200/", "::1", true)
  @TestData("http://192.168.1.2:8080/", "192.168.1.2", true)
  @TestData("http://192.168.1.2:8080/", "169.254.1.1", false)
  @TestData("https://local.test/", "10.0.0.5", true)
  @TestData("https://a.example.org/", "10.0.0.5", false)
  @TestData("wss://local.test/socket", "10.0.0.5", true)
  @TestData("ws://localhost:4200/socket", "127.0.0.1", true)
  @TestData("wss://example.com/socket", "127.0.0.1", false)
  @TestData("wss://example.com/socket", "93.184.216.34", true)
  public judgesTheAddressARequestConnectedTo(url: string, address: string, isAllowed: boolean): void {
    Assert.areEqual(isAllowed, new WebViewOriginCheck(["https://local.test"]).allowsConnection(url, WebViewOriginCheckTests.ALLOWED, address));
  }

  @TestMethod
  public readsTheBlockedPortsAtEachCheckAndRefusesEveryLoopbackPortWhileTheyAreUnknown(): void {
    let ports: ReadonlySet<number> | null = null;
    const check = new WebViewOriginCheck(["https://local.test:4600"], () => ports);
    const allowed = ["http://127.0.0.1:4600", "http://127.0.0.1:4700", "https://local.test:4600", "https://example.com"];
    const judge = (): string => [
      check.allowsRequest("http://127.0.0.1:4600/", allowed),
      check.allowsRequest("http://127.0.0.1:4700/", allowed),
      check.allowsConnection("https://local.test:4600/", allowed, "127.0.0.1"),
      check.allowsConnection("http://127.0.0.1:4700/", allowed, "127.0.0.1"),
      check.allowsRequest("https://example.com/", allowed)
    ].join(",");

    const unknown = judge();
    ports = new Set([4600]);
    const known = judge();
    ports = new Set();

    Assert.areEqual("false,false,false,false,true|false,true,false,true,true|true,true,true,true,true", [unknown, known, judge()].join("|"));
  }

  @TestMethod
  public refusesARequestWhoseAddressIsUnknown(): void {
    Assert.isFalse(new WebViewOriginCheck().allowsConnection("https://example.com/", WebViewOriginCheckTests.ALLOWED, null));
  }
}
