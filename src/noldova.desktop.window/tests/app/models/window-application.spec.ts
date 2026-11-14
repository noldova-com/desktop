/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ApplicationRef, type ComponentRef, ErrorHandler, InjectionToken, createComponent, makeEnvironmentProviders, signal } from "@angular/core";

import "@noldova/context.core";
import { ClipboardWriter, MessageAuthor, MessageAuthorKind, MessageComponent, MessageText, MessageTimeFormat, TimeFormats, provideTimeFormats } from "@noldova/ui.components.angular";

import { productName } from "../../../../../_build/generated/product";
import { ProductNameException } from "../../../src/app/exceptions/product-name.exception";
import type { IProductAbout } from "../../../src/app/interfaces/i-product-about";
import type { IWindowInputs } from "../../../src/app/interfaces/i-window-inputs";
import { BuildTokens } from "../../../src/app/models/build-tokens";
import { ModuleSwitchTokens } from "../../../src/app/models/module-switch-tokens";
import { ProductName } from "../../../src/app/models/product-name";
import { WindowApplication } from "../../../src/app/models/window-application";
import { ClosingService } from "../../../src/app/services/closing.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";
import { DomFixture } from "../../fixtures/dom.fixture";

describe("WindowApplication", () => {
  const showMessage = (application: ApplicationRef): ComponentRef<MessageComponent> => {
    const message = createComponent(MessageComponent, { environmentInjector: application.injector });
    message.setInput("author", new MessageAuthor("agent", "Agent", MessageAuthorKind.Agent));
    message.setInput("time", new Date(2026, 9, 22, 13, 5));
    message.setInput("blocks", [new MessageText("Done")]);
    message.setInput("timeFormat", MessageTimeFormat.Clock);
    application.attachView(message.hostView);
    return message;
  };
  const timeOf = (application: ApplicationRef, message: ComponentRef<MessageComponent>): readonly [string | undefined, string | null | undefined] => {
    application.tick();
    const shown = DomFixture.host(message.location).querySelector(".nol-message-time");
    return [shown?.textContent?.trim(), shown?.getAttribute("aria-label")];
  };

  afterEach(() => {
    PreloadBridgeFixture.remove();
    ProductName.use(productName);
  });

  it("names the page after the product it is given and starts the window in the page's nol-window element", async () => {
    const bridge = PreloadBridgeFixture.install();
    const host = document.body.appendChild(document.createElement("nol-window"));

    const application = await WindowApplication.startAsync({ productName: "Example Product", windowParts: [], menus: {}, gallery: null });
    await application.whenStable();
    const content = host.querySelector("nol-empty-window")?.textContent;
    application.destroy();
    host.remove();

    expect(content).toContain("No modules");
    expect([bridge.appearances.length, document.title, ProductName.current]).toEqual([1, "Example Product", "Example Product"]);
  });

  it("refuses to start without the app's product name, and starts no window and names no page", async () => {
    PreloadBridgeFixture.install();
    const host = document.body.appendChild(document.createElement("nol-window"));
    document.title = String.empty;
    const missing = "The window needs the app's product name, desktop.product.name in its root package.json, which the app's build passes to WindowApplication.startAsync.";

    const results = await Promise.allSettled([String.empty, " "].map(t => WindowApplication.startAsync({ productName: t, windowParts: [], menus: {}, gallery: null })));
    const content = host.innerHTML;
    host.remove();

    expect(results.map(t => t.status === "rejected" && t.reason instanceof ProductNameException ? t.reason.message : t.status))
      .toEqual([missing, missing]);
    expect([content, document.title, ProductName.current]).toEqual([String.empty, String.empty, productName]);
  });

  it("reads each module's menus from the JSON it is given, by module id", async () => {
    PreloadBridgeFixture.install();
    const host = document.body.appendChild(document.createElement("nol-window"));

    const application = await WindowApplication.startAsync({
      productName,
      windowParts: [],
      menus: { notes: { places: [{ name: "notes.menu", title: "Notes", shows: "menuBar" }], groups: [] } },
      gallery: null
    });
    const menus = application.injector.get(BuildTokens.menus);
    application.destroy();
    host.remove();

    expect(menus.map(t => [t.moduleId, t.places.map(u => [u.name, u.title])])).toEqual([["notes", [["notes.menu", "Notes"]]]]);
  });

  it("gives About the details the app supplies, and none when it supplies none", async () => {
    PreloadBridgeFixture.install();
    const about = { description: "Sample work, done together.", website: "https://sample.example", releases: null, licenses: "MIT", logo: { light: "about/light.png", dark: "about/dark.png" } };
    const read = async (inputs: Partial<IWindowInputs>): Promise<IProductAbout> => {
      const host = document.body.appendChild(document.createElement("nol-window"));
      const application = await WindowApplication.startAsync({ productName, windowParts: [], menus: {}, gallery: null, ...inputs });
      const given = application.injector.get(BuildTokens.about);
      application.destroy();
      host.remove();
      return given;
    };

    expect([await read({ about }), await read({})]).toEqual([about, { description: null, website: null, releases: null, licenses: null, logo: null }]);
  });

  it("gives the kit's ClipboardWriter the bridge, so text and images a kit part or module copies go through the main process", async () => {
    const bridge = PreloadBridgeFixture.install();
    const host = document.body.appendChild(document.createElement("nol-window"));
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0, 0, 0, 0];

    const application = await WindowApplication.startAsync({ productName, windowParts: [], menus: {}, gallery: null });
    const writer = application.injector.get(ClipboardWriter);
    const copied = [await writer.writeTextAsync("copied"), await writer.writeImageAsync(Uint8Array.from(png))];
    application.destroy();
    host.remove();

    expect([copied, bridge.copied, bridge.copiedImages]).toEqual([[true, true], ["copied"], [png]]);
  });

  it("saves a module's parts before a switch turns it off through the closing steps, as on closing", async () => {
    PreloadBridgeFixture.install();
    const host = document.body.appendChild(document.createElement("nol-window"));

    const application = await WindowApplication.startAsync({ productName, windowParts: [], menus: {}, gallery: null });
    const saver = application.injector.get(ModuleSwitchTokens.saver);
    const closing = application.injector.get(ClosingService);
    application.destroy();
    host.remove();

    expect(saver).toBe(closing);
  });

  it("adds the providers the app's entry gives to the window's root injector, after its own, and starts with only its own without them", async () => {
    PreloadBridgeFixture.install();
    const token = new InjectionToken<string | null>("entry", { providedIn: "root", factory: () => null });
    const handler = new ErrorHandler();
    const read = async (inputs: Pick<IWindowInputs, "providers">): Promise<[string | null, boolean]> => {
      const host = document.body.appendChild(document.createElement("nol-window"));
      const application = await WindowApplication.startAsync({ productName, windowParts: [], menus: {}, gallery: null, ...inputs });
      const values: [string | null, boolean] = [application.injector.get(token), application.injector.get(ErrorHandler) === handler];
      application.destroy();
      host.remove();
      return values;
    };

    const given = await read({ providers: [makeEnvironmentProviders([{ provide: token, useValue: "from the entry" }, { provide: ErrorHandler, useValue: handler }])] });
    const without = await read({});

    expect([given, without]).toEqual([["from the entry", true], [null, false]]);
  });

  it("gives the kit's messages the time and date and time formats, and redraws a time shown when the person changes them", async () => {
    const bridge = PreloadBridgeFixture.install();
    const host = document.body.appendChild(document.createElement("nol-window"));
    const application = await WindowApplication.startAsync({ productName, windowParts: [], menus: {}, gallery: null });
    await application.whenStable();
    const message = showMessage(application);
    const read = (time: string | null, dateTime: string | null): readonly [string | undefined, string | null | undefined] => {
      if (!Object.isNull(time))
        bridge.publishEvent("desktop.settingsChanged", { name: "desktop.timeFormat", value: time, isSet: true });
      if (!Object.isNull(dateTime))
        bridge.publishEvent("desktop.settingsChanged", { name: "desktop.dateTimeFormat", value: dateTime, isSet: true });
      return timeOf(application, message);
    };

    const shown = [read(null, null), read("HH:mm:ss", "d MMM yyyy, HH:mm"), read("h:mm:ss a", "MMM d, yyyy, h:mm a")];
    message.destroy();
    application.destroy();
    host.remove();

    expect(shown).toEqual([["1:05 PM", "Oct 22, 2026, 1:05 PM"], ["13:05:00", "22 Oct 2026, 13:05"], ["1:05:00 PM", "Oct 22, 2026, 1:05 PM"]]);
  });

  it("lets the app's entry give the kit time formats of its own in place of the window's", async () => {
    PreloadBridgeFixture.install();
    const host = document.body.appendChild(document.createElement("nol-window"));
    const formats = signal(new TimeFormats(() => "the entry's time", () => "the entry's date and time"));
    const application = await WindowApplication.startAsync({ productName, windowParts: [], menus: {}, gallery: null, providers: [provideTimeFormats(() => formats)] });
    const message = showMessage(application);
    const read = timeOf(application, message);
    message.destroy();
    application.destroy();
    host.remove();

    expect(read).toEqual(["the entry's time", "the entry's date and time"]);
  });

  it("leaves no application running for the specs after it", () => {
    expect(document.documentElement.style.length).toBe(0);
    expect(document.querySelector("nol-window")).toBeNull();
  });
});
