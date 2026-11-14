/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { LinkGesture } from "@noldova/ui.components.angular";

import { LinkPlace } from "../../../src/app/enums/link-place";
import { InAppBrowserTakenException } from "../../../src/app/exceptions/in-app-browser-taken.exception";
import { LinkNotOpenedException } from "../../../src/app/exceptions/link-not-opened.exception";
import type { IInAppBrowser } from "../../../src/app/interfaces/i-in-app-browser";
import { LinkService } from "../../../src/app/services/link.service";
import { FailureFixture } from "../../fixtures/failure.fixture";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

describe("LinkService", () => {
  let bridge: PreloadBridgeFixture;
  let errors: unknown[];
  let content: HTMLElement;

  beforeEach(() => {
    bridge = PreloadBridgeFixture.install();
    errors = [];
    TestBed.configureTestingModule({
      providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }]
    });
    content = document.createElement("div");
    content.innerHTML = [
      "<a class=\"docs\" href=\"https://example.com/docs\"><span>Docs</span></a>",
      "<a class=\"mail\" href=\"mailto:support@example.com\">Mail</a>",
      "<a class=\"local\" href=\"file:///etc/passwd\">Local</a>",
      "<a class=\"top\" href=\"#top\">Top</a>",
      "<a class=\"bare\">Bare</a>",
      "<button class=\"other\" type=\"button\">Other</button>"
    ].join(String.empty);
    document.body.append(content);
  });

  afterEach(() => {
    content.remove();
    PreloadBridgeFixture.remove();
  });

  function click(selector: string, type: string = "click", button: number = 0, ctrlKey: boolean = false): boolean {
    const target = content.querySelector(selector) ?? content;
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button, ctrlKey });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }

  function browser(place: (url: string, gesture: LinkGesture) => LinkPlace, open: (url: string) => Promise<void> = () => Promise.resolve()): { browser: IInAppBrowser; asked: string[]; opened: string[] } {
    const asked: string[] = [];
    const opened: string[] = [];
    return {
      browser: {
        placeFor: (url, gesture) => {
          asked.push(`${url} ${gesture}`);
          return place(url, gesture);
        },
        openAsync: async url => {
          await open(url);
          opened.push(url);
        }
      },
      asked,
      opened
    };
  }

  it("opens a link clicked in the window's content through the main process, also with the middle button, and leaves in-page links, other buttons and other elements alone", async () => {
    const stop = TestBed.inject(LinkService).listen();

    const prevented = [
      click(".docs span"),
      click(".mail", "auxclick", 1),
      click(".docs", "auxclick", 2),
      click(".top"),
      click(".bare"),
      click(".other")
    ];
    await Promise.resolve();

    expect(prevented).toEqual([true, true, false, false, false, false]);
    expect(bridge.links).toEqual(["https://example.com/docs", "mailto:support@example.com"]);
    expect(errors).toEqual([]);
    stop();
  });

  it("leaves a click a window part already handled, and stops listening once stopped", () => {
    const stop = TestBed.inject(LinkService).listen();
    const handled = content.querySelector(".mail");
    handled?.addEventListener("click", t => t.preventDefault());

    const handledPrevented = click(".mail");
    stop();
    const prevented = click(".mail", "auxclick", 1);

    expect([handledPrevented, prevented, bridge.links]).toEqual([true, false, []]);
  });

  it("opens a web link in the in-app browser where it places the link by its gesture, a place the part gives without asking, and every other link in the system's browser", async () => {
    const service = TestBed.inject(LinkService);
    const inApp = browser((_, gesture) => gesture === LinkGesture.Plain ? LinkPlace.InApp : LinkPlace.System);
    service.register(inApp.browser, () => undefined);

    await service.openAsync("https://example.com/plain");
    await service.openAsync("http://example.com/modified", { gesture: LinkGesture.Modified });
    await service.openAsync("https://example.com/given", { gesture: LinkGesture.Middle, place: LinkPlace.InApp });
    await service.openAsync("https://example.com/system", { place: LinkPlace.System });
    await service.openAsync("mailto:support@example.com", { place: LinkPlace.InApp });
    await service.openAsync("file:///home/ada/notes.txt");

    expect(inApp.asked).toEqual(["https://example.com/plain Plain", "http://example.com/modified Modified"]);
    expect(inApp.opened).toEqual(["https://example.com/plain", "https://example.com/given"]);
    expect(bridge.links).toEqual(["http://example.com/modified", "https://example.com/system", "mailto:support@example.com", "file:///home/ada/notes.txt"]);
  });

  it("hands the in-app browser only a link the system would open, in its normalized form, and leaves one with credentials, too long or malformed to the system", async () => {
    const service = TestBed.inject(LinkService);
    const inApp = browser(() => LinkPlace.InApp);
    service.register(inApp.browser, () => undefined);
    const long = `https://example.com/${"x".repeat(32749)}`;

    const refused = ["https://ada:secret@example.com/", "https://ada@example.com/", long, "https://[example/"];

    await service.openAsync("HTTPS://Example.COM/Docs?page=2");
    bridge.isLinkOpened = false;
    const refusals = await Promise.all(refused.map(t => service.openAsync(t, { place: LinkPlace.InApp }).catch((error: unknown) => error)));

    expect(inApp.asked).toEqual(["https://example.com/Docs?page=2 Plain"]);
    expect(inApp.opened).toEqual(["https://example.com/Docs?page=2"]);
    expect(bridge.links).toEqual(refused);
    expect(refusals.map(t => t instanceof LinkNotOpenedException)).toEqual([true, true, true, true]);
  });

  it("opens a link in the system's browser and logs only the failure's kind when the in-app browser fails to place or open it", async () => {
    const service = TestBed.inject(LinkService);
    const logged: string[] = [];
    const failing = browser(url => {
      if (url.endsWith("placed"))
        throw "The secret https://example.com/placed?token=1 failed.";
      return LinkPlace.InApp;
    }, () => Promise.reject(new TypeError("The page https://example.com/opened?token=1 failed.")));
    service.register(failing.browser, t => logged.push(t));

    await service.openAsync("https://example.com/placed");
    await service.openAsync("https://example.com/opened");

    expect([bridge.links, failing.opened]).toEqual([["https://example.com/placed", "https://example.com/opened"], []]);
    expect(logged).toEqual([
      "The in-app browser did not open a link, which opened in the system's browser instead: string.",
      "The in-app browser did not open a link, which opened in the system's browser instead: TypeError."
    ]);
  });

  it("takes one in-app browser at a time, keeps it when an earlier one's release comes late, and opens every link in the system's browser once it goes", async () => {
    const service = TestBed.inject(LinkService);
    const first = browser(() => LinkPlace.InApp);
    const second = browser(() => LinkPlace.InApp);
    const releaseFirst = service.register(first.browser, () => undefined);
    const refusal = (() => {
      try {
        service.register(second.browser, () => undefined);
        return null;
      }
      catch (error) {
        return error;
      }
    })();
    releaseFirst();
    const releaseSecond = service.register(second.browser, () => undefined);
    releaseFirst();
    const isKept = service.hasInAppBrowser;
    await service.openAsync("https://example.com/kept");
    releaseSecond();
    await service.openAsync("https://example.com/gone");

    expect([refusal instanceof InAppBrowserTakenException, FailureFixture.of(refusal, Error).message, isKept, service.hasInAppBrowser])
      .toEqual([true, "Another window part is already the in-app browser.", true, false]);
    expect([second.opened, bridge.links]).toEqual([["https://example.com/kept"], ["https://example.com/gone"]]);
  });

  it("gives the in-app browser a clicked link's gesture: a click, a click with Ctrl or Cmd, and the middle button", async () => {
    const service = TestBed.inject(LinkService);
    const inApp = browser(() => LinkPlace.System);
    service.register(inApp.browser, () => undefined);
    const stop = service.listen();

    click(".docs span");
    click(".docs", "click", 0, true);
    click(".docs", "auxclick", 1);
    await vi.waitFor(() => expect(bridge.links.length).toBe(3));

    expect(inApp.asked).toEqual(["https://example.com/docs Plain", "https://example.com/docs Modified", "https://example.com/docs Middle"]);
    stop();
  });

  it("shows the link menu for a web link right-clicked in the window's content, and leaves other links, in-page links and handled right-clicks to their default", () => {
    const service = TestBed.inject(LinkService);
    const stop = service.listen();
    content.querySelector(".docs")?.addEventListener("contextmenu", t => t.preventDefault(), { once: true });

    const prevented = [click(".mail", "contextmenu", 2), click(".top", "contextmenu", 2), click(".other", "contextmenu", 2), click(".docs", "contextmenu", 2)];
    const before = service.menu();
    const onDocs = click(".docs span", "contextmenu", 2);
    const shown = service.menu();
    stop();
    click(".docs", "contextmenu", 2);

    expect([prevented, before, onDocs, shown?.url, shown?.event.type, service.menu()]).toEqual([[false, false, false, true], null, true, "https://example.com/docs", "contextmenu", shown]);
  });

  it("reports a link the main process does not open", async () => {
    bridge.isLinkOpened = false;
    const stop = TestBed.inject(LinkService).listen();

    const prevented = click(".local");
    await vi.waitFor(() => expect(errors.length).toBe(1));

    expect([prevented, bridge.links]).toEqual([true, ["file:///etc/passwd"]]);
    expect([errors[0] instanceof LinkNotOpenedException, FailureFixture.of(errors[0], Error).message])
      .toEqual([true, "Noldova Desktop Sample did not open the link: it opens only well-formed http, https and mailto links, in the system's own application."]);
    stop();
  });
});
