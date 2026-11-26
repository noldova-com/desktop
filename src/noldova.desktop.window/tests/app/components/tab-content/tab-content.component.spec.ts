/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ErrorHandler, type InputSignal, type Signal, type Type, type WritableSignal, inject, input, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { ModuleState } from "@noldova/desktop.protocol";

import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { TabContentComponent } from "../../../../src/app/components/tab-content/tab-content.component";
import { ContentPadding } from "../../../../src/app/enums/content-padding";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { FileSaveOutcome } from "../../../../src/app/enums/file-save-outcome";
import { WindowPartFailureException } from "../../../../src/app/exceptions/window-part-failure.exception";
import type { IWindowPartContext } from "../../../../src/app/interfaces/i-window-part-context";
import type { ContentPaddingRef } from "../../../../src/app/models/content-padding-ref";
import { ContributionMatch } from "../../../../src/app/models/contribution-match";
import { IssuedFileGrants } from "../../../../src/app/models/issued-file-grants";
import type { Bounds } from "../../../../src/app/models/layout/bounds";
import { DocumentTab } from "../../../../src/app/models/layout/document-tab";
import { Layout } from "../../../../src/app/models/layout/layout";
import type { Tab } from "../../../../src/app/models/layout/tab";
import { ViewTab } from "../../../../src/app/models/layout/view-tab";
import { ModuleFailure } from "../../../../src/app/models/module-failure";
import { ShellDocuments } from "../../../../src/app/models/shell-documents";
import { WindowPartContext } from "../../../../src/app/models/window-part-context";
import { WindowPartSource } from "../../../../src/app/models/window-part-source";
import { PageTokens } from "../../../../src/app/models/page-tokens";
import { WindowPartTokens } from "../../../../src/app/models/window-part-tokens";
import { DockGrowthService } from "../../../../src/app/services/dock-growth.service";
import { TabLabelService } from "../../../../src/app/services/tab-label.service";
import { WindowPartHostService } from "../../../../src/app/services/window-part-host.service";
import { DomFixture } from "../../../fixtures/dom.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";
import { ModuleStatusFixture } from "../../../fixtures/module-status.fixture";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";

@Component({
  selector: "nol-test-view",
  template: "<p class=\"view\">notes</p>"
})
class TestViewComponent {
  public static contexts: IWindowPartContext[] = [];

  public constructor() {
    TestViewComponent.contexts.push(inject(WindowPartTokens.context));
  }
}

@Component({
  selector: "nol-test-document",
  template: "<p class=\"document\">{{ instance() }}: {{ title() }}</p>"
})
class TestDocumentComponent {
  public readonly instance: InputSignal<string> = input.required<string>();
  public readonly title: InputSignal<string> = input.required<string>();
}

@Component({
  selector: "nol-test-page",
  template: "<p class=\"page\">page</p>"
})
class TestPageComponent {
}

@Component({
  selector: "nol-test-shell-document",
  template: "<p class=\"shell-document\">settings</p>"
})
class TestShellDocumentComponent {
  public static contexts: (IWindowPartContext | null)[] = [];

  public constructor() {
    TestShellDocumentComponent.contexts.push(inject(WindowPartTokens.context, { optional: true }));
  }
}

class StubWindowPartHost {
  public readonly revisions: WritableSignal<ReadonlyMap<string, number>> = signal(new Map());
  public readonly contributions: Map<string, ContributionMatch> = new Map();
  public readonly failures: Map<string, ModuleFailure> = new Map();

  public findContribution(tab: Tab): ContributionMatch | null {
    return this.contributions.get(tab.key) ?? null;
  }

  public findFailure(tab: Tab): ModuleFailure | null {
    return this.failures.get(tab.key) ?? null;
  }

  public revisionOf(tab: Tab): number {
    return this.revisions().get(tab.key) ?? 0;
  }
}

describe("TabContentComponent", () => {
  const context = new WindowPartContext(new WindowPartSource("notes", [], [], [], [], [], [], [], () => Promise.reject(new Error("unused"))), {
    agentControl: signal(null),
    platform: "linux",
    requestAsync: () => Promise.resolve(null),
    onEvent: () => () => undefined,
    openDocument: () => undefined,
    keepDocument: () => undefined,
    closeDocument: () => undefined,
    forgetDocument: () => undefined,
    onDocumentClosed: () => () => undefined,
    onTabRenamed: () => () => undefined,
    listOpenDocumentsAsync: () => Promise.resolve([]),
    updateDocument: () => undefined,
    openDocumentLook: () => undefined,
    updateDocumentLook: () => undefined,
    openView: () => undefined,
    updateView: () => undefined,
    closeView: () => undefined,
    returnView: () => undefined,
    closeDialog: () => undefined,
    showView: () => undefined,
    hideViewDock: () => undefined,
    growViewDock: () => () => undefined,
    viewDockOf: () => signal(null),
    onViewClosed: () => () => undefined,
    recordPlace: () => undefined,
    forgetPlace: () => undefined,
    onPlaceShown: () => () => undefined,
    showInDialogAsync: () => Promise.resolve(),
    openBelowWindowRow: () => null,
    log: () => undefined,
    noteIcon: () => undefined,
    setTabWorking: () => undefined,
    setTabWaiting: () => undefined,
    registerSelectionSource: () => () => undefined,
    provideUndo: () => () => undefined,
    openLinkAsync: () => Promise.resolve(),
    showLinkMenu: () => undefined,
    registerInAppBrowser: () => () => undefined,
    showInFolderAsync: () => Promise.resolve(),
    openFileAsync: () => Promise.resolve(),
    openWebViewAsync: () => Promise.reject(new Error("unused")),
    chooseFolderAsync: () => Promise.resolve(null),
    chooseFilePathAsync: () => Promise.resolve(null),
    saveFileAsync: () => Promise.resolve(FileSaveOutcome.Cancelled),
    chooseFilesAsync: () => Promise.resolve(IssuedFileGrants.none),
    grantFilesAsync: () => Promise.resolve(IssuedFileGrants.none),
    discardFileGrants: () => undefined,
    isCommandRegistered: () => false,
    findPlaceholderName: () => null,
    runCommandAsync: () => Promise.resolve(null),
    findWindowCommand: () => null,
    keyOf: () => signal(null),
    postNotificationAsync: () => Promise.resolve("1"),
    dismissNotification: () => undefined,
    readSetting: () => undefined,
    readSettingAsync: () => Promise.reject(new Error("unused")),
    writeSettingAsync: () => Promise.resolve(),
    resetSettingAsync: () => Promise.resolve(),
    onSettingChanged: () => () => undefined,
    declaresDynamicMenuGroup: () => false,
    provideMenuGroup: () => () => undefined,
    declaresDynamicSetting: () => false,
    provideSettingOptions: () => () => undefined,
    refreshSettingOptions: () => undefined,
    declaresCheckedSetting: () => false,
    provideSettingCheck: () => () => undefined,
    setViewBadge: () => undefined,
    refresh: () => undefined
  });
  let host: StubWindowPartHost;

  beforeEach(() => {
    PreloadBridgeFixture.install();
    host = new StubWindowPartHost();
    TestViewComponent.contexts = [];
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartHostService, useValue: host },
      { provide: DockGrowthService, useValue: { minimumOf: () => null, fit: () => undefined } }] });
  });

  afterEach(() => {
    PreloadBridgeFixture.remove();
  });

  async function renderAsync(tab: Tab): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(TabContentComponent);
    fixture.componentRef.setInput("tab", tab);
    await fixture.whenStable();
    return DomFixture.host(fixture);
  }

  it("shows a view with its module's context", async () => {
    const tab = new ViewTab("notes.list");
    host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestViewComponent), context, ContentPadding.Default));

    const element = await renderAsync(tab);

    expect(element.querySelector(".view")?.textContent).toBe("notes");
    expect(TestViewComponent.contexts).toEqual([context]);
  });

  it("shows a document with its instance and title", async () => {
    const tab = new DocumentTab("notes.note", "1");
    TestBed.inject(TabLabelService).setTitle(tab, "Note 1");
    host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestDocumentComponent), context, ContentPadding.Default));

    const element = await renderAsync(tab);

    expect(element.querySelector(".document")?.textContent).toBe("1: Note 1");
  });

  it("shows an instance of a view with its instance and title", async () => {
    const tab = new ViewTab("terminal.shell", "2");
    TestBed.inject(TabLabelService).setTitle(tab, "bash");
    host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestDocumentComponent), context, ContentPadding.Default));

    const element = await renderAsync(tab);

    expect(element.querySelector(".document")?.textContent).toBe("2: bash");
  });

  it("shows a shell document without a part's context or inputs", async () => {
    const tab = new DocumentTab("desktop.settings");
    TestShellDocumentComponent.contexts = [];
    host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestShellDocumentComponent), null, ContentPadding.Default));

    const element = await renderAsync(tab);

    expect(element.querySelector(".shell-document")?.textContent).toBe("settings");
    expect(TestShellDocumentComponent.contexts).toEqual([null]);
  });

  it("keeps its content while only another tab's revision changes", async () => {
    const tab = ShellDocuments.settingsTab;
    TestShellDocumentComponent.contexts = [];
    host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestShellDocumentComponent), null, ContentPadding.Default));
    const fixture = TestBed.createComponent(TabContentComponent);
    fixture.componentRef.setInput("tab", tab);
    await fixture.whenStable();
    const element: HTMLElement = DomFixture.host(fixture);
    const shown = element.querySelector(".shell-document");

    host.revisions.set(new Map([[new ViewTab("clock.face").key, 1]]));
    await fixture.whenStable();

    expect(element.querySelector(".shell-document")).toBe(shown);
    expect(TestShellDocumentComponent.contexts).toEqual([null]);
  });

  it("keeps its content when it is given an equal tab", async () => {
    host.contributions.set(new ViewTab("notes.list").key, new ContributionMatch(() => Promise.resolve(TestViewComponent), context, ContentPadding.Default));
    const fixture = TestBed.createComponent(TabContentComponent);
    fixture.componentRef.setInput("tab", new ViewTab("notes.list"));
    await fixture.whenStable();
    const element: HTMLElement = DomFixture.host(fixture);
    const shown = element.querySelector(".view");

    fixture.componentRef.setInput("tab", new ViewTab("notes.list"));
    await fixture.whenStable();

    expect(element.querySelector(".view")).toBe(shown);
    expect(TestViewComponent.contexts).toEqual([context]);
  });

  it("gives its page the toolbar band of its view or document, with the page's name and instance as arguments", async () => {
    const bandOf = async (tab: Tab): Promise<readonly unknown[]> => {
      host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestPageComponent), null, ContentPadding.Default));
      const fixture = TestBed.createComponent(TabContentComponent);
      fixture.componentRef.setInput("tab", tab);
      await fixture.whenStable();
      const page = fixture.debugElement.query(By.directive(TestPageComponent)).injector.get(PageTokens.toolbarBand);
      return [page.band, page.context];
    };

    expect([await bandOf(new ViewTab("notes.list")), await bandOf(new ViewTab("notes.session", "one")), await bandOf(new DocumentTab("notes.note", "1"))]).toEqual([
      ["notes.list", { view: "notes.list" }], ["notes.session", { view: "notes.session", instance: "one" }], ["notes.note", { document: "notes.note", instance: "1" }]
    ]);
  });

  it("tells its page whether the page is shown", async () => {
    const tab = new ViewTab("notes.list");
    host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestPageComponent), null, ContentPadding.Default));
    const fixture = TestBed.createComponent(TabContentComponent);
    fixture.componentRef.setInput("tab", tab);
    await fixture.whenStable();
    const shown = fixture.debugElement.query(By.directive(TestPageComponent)).injector.get(WindowPartTokens.shown);
    const states = [shown()];

    fixture.componentRef.setInput("isShown", false);
    states.push(shown());

    expect(states).toEqual([true, false]);
  });

  it("tells its page whether its tab is the window's active document, from a restored split on, as the active tab or the active document group changes", async () => {
    const { plan, todo, settings, files } = LayoutFixture;
    const registry = LayoutFixture.createRegistry();
    const saved = Layout.createDefault(registry).openDocument(plan).openDocument(todo).splitGroup(todo, 0, PanelEdge.Right);
    const layout = await LayoutServiceFixture.prepareAsync(registry, saved);
    host.contributions.set(plan.key, new ContributionMatch(() => Promise.resolve(TestPageComponent), null, ContentPadding.Default));
    host.contributions.set(todo.key, new ContributionMatch(() => Promise.resolve(TestPageComponent), null, ContentPadding.Default));
    host.contributions.set(files.key, new ContributionMatch(() => Promise.resolve(TestPageComponent), null, ContentPadding.Default));
    const activeOf = async (tab: Tab): Promise<Signal<boolean>> => {
      const fixture = TestBed.createComponent(TabContentComponent);
      fixture.componentRef.setInput("tab", tab);
      await fixture.whenStable();
      return fixture.debugElement.query(By.directive(TestPageComponent)).injector.get(WindowPartTokens.activeDocument);
    };
    const active = await activeOf(plan);
    const besides = await activeOf(todo);
    const view = await activeOf(files);
    const groupOf = (tab: Tab): number => layout.layout().documentGroups.find(t => t.has(tab))?.id ?? -1;
    const restored = [active(), besides()];

    layout.focusGroup(groupOf(plan));
    const states = [active()];
    layout.focusGroup(groupOf(todo));
    states.push(active());
    layout.activate(plan);
    states.push(active());
    layout.openDocument(settings);
    states.push(active());

    expect([restored, states]).toEqual([[false, true], [true, false, true, false]]);
    expect(view()).toBe(false);
  });

  for (const theme of AppearanceFixture.themes)
    it(`asks to grow its dock with the size its page gets with the ${theme.id} theme, in rem inside its padding, once it shows loaded in a dock and a part asked for it`, async () => {
      AppearanceFixture.apply(theme);
      try {
        const tab = new ViewTab("notes.list");
        host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestViewComponent), context, ContentPadding.Default));
        const fits: string[] = [];
        let minimum: number | null = null;
        TestBed.overrideProvider(DockGrowthService, { useValue: { minimumOf: () => minimum, fit: (fitted: Tab, content: Bounds) => fits.push(`${fitted.key} ${content.width} ${content.height}`) } });
        const fixture = TestBed.createComponent(TabContentComponent);
        const element = DomFixture.host(fixture);
        element.style.display = "block";
        element.style.inlineSize = "320px";
        element.style.blockSize = "160px";
        fixture.componentRef.setInput("tab", tab);
        await fixture.whenStable();
        minimum = 20;
        const steps: (readonly string[])[] = [];
        for (const [input, value] of [["isShown", false], ["isDocked", true], ["isShown", true]] as const) {
          fixture.componentRef.setInput(input, value);
          fixture.detectChanges();
          await fixture.whenStable();
          steps.push([...fits]);
        }

        const style = getComputedStyle(element);
        const rootSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
        const width = (320 - (element.offsetWidth - element.clientWidth)) / rootSize;
        const height = 160 / rootSize;
        expect(steps).toEqual([[], [], [`${tab.key} ${width} ${height}`]]);
        expect([Number.parseFloat(style.paddingTop), Number.parseFloat(style.paddingLeft)].every(t => t > 0)).toBe(true);
      }
      finally {
        AppearanceFixture.reset();
      }
    });

  it("asks to grow no dock while its page has no size", async () => {
    const tab = new ViewTab("notes.list");
    host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestViewComponent), context, ContentPadding.None));
    const fits: string[] = [];
    TestBed.overrideProvider(DockGrowthService, { useValue: { minimumOf: () => 20, fit: (fitted: Tab) => fits.push(fitted.key) } });
    const fixture = TestBed.createComponent(TabContentComponent);
    DomFixture.host(fixture).style.display = "none";
    fixture.componentRef.setInput("tab", tab);
    fixture.componentRef.setInput("isDocked", true);
    await fixture.whenStable();

    expect(fits).toEqual([]);
  });

  it("shows why a failed module's view is empty", async () => {
    const tab = new ViewTab("clock.face");
    host.failures.set(tab.key, new ModuleFailure("clock", "Clock", ModuleState.Failed, "Its runtime part failed to activate.", ["clock.face"]));

    const element = await renderAsync(tab);

    expect(element.querySelector("nol-module-failure-card")?.textContent).toMatch(/Clock didn't start\s*Its runtime part failed to activate\./);
  });

  it("shows a card naming its module for a page that fails to load, by its id until the runtime reports the module's name and by that name from then on, and reports the failure once", async () => {
    const errors: unknown[] = [];
    TestBed.overrideProvider(ErrorHandler, { useValue: { handleError: (error: unknown) => errors.push(error) } });
    const tab = new ViewTab("notes.list");
    host.contributions.set(tab.key, new ContributionMatch(() => Promise.reject(new Error("No notes.list chunk.")), context, ContentPadding.Default));
    const fixture = TestBed.createComponent(TabContentComponent);
    fixture.componentRef.setInput("tab", tab);
    await fixture.whenStable();
    const card = (): string | null | undefined => DomFixture.host(fixture).querySelector("nol-module-failure-card")?.textContent;

    const unnamed = card();
    ModuleStatusFixture.report(ModuleStatusFixture.create("notes", "Notes"));
    await fixture.whenStable();
    fixture.detectChanges();

    expect([unnamed, card()]).toEqual([expect.stringMatching(/notes didn't start\s*Its page could not be loaded\./), expect.stringMatching(/Notes didn't start\s*Its page could not be loaded\./)]);
    expect(DomFixture.host(fixture).classList.contains("nol-tab-content-padded")).toBe(true);
    expect(errors.map(t => t instanceof WindowPartFailureException ? [t.name, t.moduleId, t.message, t.cause instanceof Error ? t.cause.message : null] : t)).toEqual([
      ["PageNotLoadedException", "notes", "Its page could not be loaded.", "No notes.list chunk."]
    ]);
  });

  it("keeps the page a newer load shows when an older load it replaced fails later", async () => {
    TestBed.overrideProvider(ErrorHandler, { useValue: { handleError: () => undefined } });
    const tab = new ViewTab("notes.list");
    let fail: (error: Error) => void = () => undefined;
    const slow = new Promise<Type<unknown>>((_resolve, reject) => fail = reject);
    host.contributions.set(tab.key, new ContributionMatch(() => slow, context, ContentPadding.Default));
    const fixture = TestBed.createComponent(TabContentComponent);
    fixture.componentRef.setInput("tab", tab);
    fixture.detectChanges();

    host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestViewComponent), context, ContentPadding.Default));
    host.revisions.set(new Map([[tab.key, 1]]));
    await fixture.whenStable();
    fail(new Error("No notes.list chunk."));
    await slow.catch(() => undefined);
    await fixture.whenStable();
    fixture.detectChanges();

    expect([DomFixture.host(fixture).querySelector(".view")?.textContent, DomFixture.host(fixture).querySelector("nol-module-failure-card")]).toEqual(["notes", null]);
  });

  it("shows nothing for a shell page that fails to load and reports its failure once", async () => {
    const errors: unknown[] = [];
    TestBed.overrideProvider(ErrorHandler, { useValue: { handleError: (error: unknown) => errors.push(error) } });
    const failure = new Error("No settings chunk.");
    const tab = new DocumentTab("desktop.settings");
    host.contributions.set(tab.key, new ContributionMatch(() => Promise.reject(failure), null, ContentPadding.Default));
    const fixture = TestBed.createComponent(TabContentComponent);
    fixture.componentRef.setInput("tab", tab);
    await fixture.whenStable();

    fixture.detectChanges();

    expect([DomFixture.host(fixture).children.length, DomFixture.host(fixture).classList.contains("nol-tab-content-padded"), errors]).toEqual([0, false, [failure]]);
  });

  it("shows nothing for a tab no module contributes and loads again when its revision changes", async () => {
    const tab = new ViewTab("notes.list");
    const fixture = TestBed.createComponent(TabContentComponent);
    fixture.componentRef.setInput("tab", tab);
    await fixture.whenStable();
    const element: HTMLElement = DomFixture.host(fixture);
    const isEmpty = element.children.length === 0;

    host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestViewComponent), context, ContentPadding.Default));
    host.revisions.set(new Map([[tab.key, 1]]));
    await fixture.whenStable();

    expect(isEmpty).toBe(true);
    expect(element.querySelector(".view")?.textContent).toBe("notes");
  });

  it("scrolls with a stable gutter and a hover-revealed thumb", async () => {
    AppearanceFixture.apply();
    try {
      const tab = new ViewTab("notes.list");
      host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestViewComponent), context, ContentPadding.Default));
      const fixture = TestBed.createComponent(TabContentComponent);
      fixture.componentRef.setInput("tab", tab);
      await fixture.whenStable();
      const element: HTMLElement = DomFixture.host(fixture);

      expect(getComputedStyle(element).scrollbarGutter).toBe("stable");
      await AppearanceFixture.expectThumbRevealsOnHoverAsync(element);
    }
    finally {
      AppearanceFixture.reset();
    }
  });

  it("reserves no scrollbar gutter around a page that opts out of the padding, so the page's own scroller reaches the panel's edge", async () => {
    const tab = new ViewTab("notes.outline");
    host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestViewComponent), context, ContentPadding.None));
    const element = await renderAsync(tab);

    expect([element.classList.contains("nol-tab-content-padded"), getComputedStyle(element).scrollbarGutter]).toEqual([false, "auto"]);
  });

  for (const theme of AppearanceFixture.themes)
    it(`pads a page with the ${theme.id} theme's content padding at the sides, and at the top and bottom with its document padding in the middle and its view padding in a dock`, async () => {
      AppearanceFixture.apply(theme);
      try {
        const tab = new ViewTab("notes.list");
        host.contributions.set(tab.key, new ContributionMatch(() => Promise.resolve(TestViewComponent), context, ContentPadding.Default));
        const fixture = TestBed.createComponent(TabContentComponent);
        fixture.componentRef.setInput("tab", tab);
        await fixture.whenStable();
        const style = getComputedStyle(DomFixture.host(fixture));
        const middle = [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
        fixture.componentRef.setInput("isDocked", true);
        fixture.detectChanges();
        const docked = [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];

        AppearanceFixture.expectPixels(Number.parseFloat(style.paddingLeft), AppearanceFixture.measureLook("tab-inset") * 3 + AppearanceFixture.measureLook("pill-padding"));
        for (const [values, block, inline] of [[middle, "document-padding-block", "content-padding-inline"], [docked, "view-padding-block", "content-padding-inline"]] as const)
          for (const [index, property] of ["padding-top", "padding-right", "padding-bottom", "padding-left"].entries())
            AppearanceFixture.expectLook(DomFixture.present(values[index]), theme, index % 2 === 0 ? block : inline, property);
      }
      finally {
        AppearanceFixture.reset();
      }
    });

  it("leaves a page edge to edge when its contribution opts out, and lets the page itself turn the padding off or on over its contribution's choice until it resets", async () => {
    const plain = new ViewTab("notes.outline");
    const list = new ViewTab("notes.list");
    const terminal = new ViewTab("notes.terminal");
    host.contributions.set(plain.key, new ContributionMatch(() => Promise.resolve(TestViewComponent), context, ContentPadding.None));
    host.contributions.set(list.key, new ContributionMatch(() => Promise.resolve(TestPageComponent), null, ContentPadding.Default));
    host.contributions.set(terminal.key, new ContributionMatch(() => Promise.resolve(TestPageComponent), null, ContentPadding.None));
    const renderPageAsync = async (tab: ViewTab): Promise<readonly [ComponentFixture<TabContentComponent>, ContentPaddingRef]> => {
      const fixture = TestBed.createComponent(TabContentComponent);
      fixture.componentRef.setInput("tab", tab);
      await fixture.whenStable();
      return [fixture, fixture.debugElement.query(By.directive(TestPageComponent)).injector.get(WindowPartTokens.contentPadding)];
    };
    const outline = await renderAsync(plain);
    const [listFixture, listPadding] = await renderPageAsync(list);
    const [terminalFixture, terminalPadding] = await renderPageAsync(terminal);
    const padded = (): readonly boolean[] => [listFixture, terminalFixture].map(t => {
      t.detectChanges();
      const element: HTMLElement = DomFixture.host(t);
      return element.classList.contains("nol-tab-content-padded");
    });
    const states = [padded()];

    listPadding.set(ContentPadding.None);
    terminalPadding.set(ContentPadding.Default);
    states.push(padded());
    listPadding.reset();
    terminalPadding.reset();
    states.push(padded());

    expect(outline.classList.contains("nol-tab-content-padded")).toBe(false);
    expect(states).toEqual([[true, false], [false, true], [true, false]]);
  });

  it("pads the card of a failed module's view and leaves an empty tab unpadded", async () => {
    const failed = new ViewTab("clock.face");
    host.failures.set(failed.key, new ModuleFailure("clock", "Clock", ModuleState.Failed, "Its runtime part failed to activate.", ["clock.face"]));

    const elements = [await renderAsync(failed), await renderAsync(new ViewTab("notes.list"))];

    expect(elements.map(t => t.classList.contains("nol-tab-content-padded"))).toEqual([true, false]);
  });
});
