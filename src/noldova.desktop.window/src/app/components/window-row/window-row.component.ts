/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { OverlayContainer } from "@angular/cdk/overlay";
import { NgTemplateOutlet } from "@angular/common";
import { Component, DestroyRef, ElementRef, ErrorHandler, PendingTasks, type Signal, type WritableSignal, afterNextRender, afterRenderEffect, computed, effect, inject, signal, viewChild } from "@angular/core";

import { AppearanceService, DialogService, IconButtonComponent, MenuBarComponent, MenuBarItemComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective, OverlaySide, TooltipDirective } from "@noldova/ui.components.angular";
import type { JsonValue } from "@noldova/context.json";

import { BuildTokens } from "../../models/build-tokens.js";
import { ProductName } from "../../models/product-name.js";
import { Resources } from "../../../resources.js";
import { DockSide } from "../../enums/dock-side.js";
import { MenuBarStyle } from "../../enums/menu-bar-style.js";
import { WindowAppearance } from "../../models/window-appearance.js";
import type { DocumentHeading } from "../../models/document-heading.js";
import type { IProductTitleBar } from "../../interfaces/i-product-title-bar.js";
import { DocumentTab } from "../../models/layout/document-tab.js";
import { ViewTab } from "../../models/layout/view-tab.js";
import { BarItemsService } from "../../services/bar-items.service.js";
import { CommandService } from "../../services/command.service.js";
import { DialogCoverService } from "../../services/dialog-cover.service.js";
import { PreloadBridgeService } from "../../services/preload-bridge.service.js";
import { LayoutService } from "../../services/layout.service.js";
import { LayoutMenuService } from "../../services/layout-menu.service.js";
import { MenuBarService } from "../../services/menu-bar.service.js";
import { SearchPaletteService } from "../../services/search-palette.service.js";
import { SearchService } from "../../services/search.service.js";
import { SettingsService } from "../../services/settings.service.js";
import { TabLabelService } from "../../services/tab-label.service.js";
import { PlaceMenuComponent } from "../place-menu/place-menu.component.js";
import { WindowControlsComponent } from "../window-controls/window-controls.component.js";

@Component({
  selector: "nol-window-row",
  imports: [IconButtonComponent, MenuBarComponent, MenuBarItemComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective, NgTemplateOutlet, PlaceMenuComponent, TooltipDirective, WindowControlsComponent],
  templateUrl: "./window-row.component.html",
  styleUrl: "./window-row.component.css",
  host: {
    "data-nol-chrome": "top",
    "[class.nol-window-row-mac]": "isMac",
    "[class.nol-window-row-drawn-controls]": "isDrawingControls",
    "[class.nol-window-row-full-screen]": "isFullScreen()",
    "(document:keydown)": "pressed($event)",
    "(document:keyup)": "released($event)",
    "(document:pointerdown)": "pointed()"
  }
})
export class WindowRowComponent {
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);
  private readonly commands: CommandService = inject(CommandService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly labels: TabLabelService = inject(TabLabelService);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly foldedValue: WritableSignal<boolean> = signal(false);
  private readonly shiftValue: WritableSignal<number> = signal(0);
  private readonly iconShownValue: WritableSignal<boolean> = signal(true);
  private readonly nameShownValue: WritableSignal<boolean> = signal(true);
  private readonly nameRoom: WritableSignal<number | null> = signal(null);
  private readonly fontLoads: WritableSignal<number> = signal(0);
  private readonly fullScreenValue: WritableSignal<boolean> = signal(false);
  private readonly bar: Signal<ElementRef<HTMLElement> | undefined> = viewChild("bar", { read: ElementRef });
  private readonly menuButton: Signal<ElementRef<HTMLElement> | undefined> = viewChild("menuButton", { read: ElementRef });
  private readonly start: Signal<ElementRef<HTMLElement>> = viewChild.required("start", { read: ElementRef });
  private readonly end: Signal<ElementRef<HTMLElement>> = viewChild.required("end", { read: ElementRef });
  private readonly controls: Signal<ElementRef<HTMLElement> | undefined> = viewChild(WindowControlsComponent, { read: ElementRef });
  private readonly middle: Signal<ElementRef<HTMLElement>> = viewChild.required("middle", { read: ElementRef });
  private readonly field: Signal<ElementRef<HTMLElement>> = viewChild.required("field", { read: ElementRef });
  private readonly identity: Signal<ElementRef<HTMLElement> | undefined> = viewChild("identity", { read: ElementRef });
  private readonly identityIcon: Signal<ElementRef<HTMLElement> | undefined> = viewChild("identityIcon", { read: ElementRef });
  private returnFocus: HTMLElement | null = null;
  private isAltAlone: boolean = false;

  protected readonly resources: typeof Resources = Resources;
  protected readonly titleBar: IProductTitleBar = inject(BuildTokens.titleBar);
  protected readonly hasIdentity: boolean = !Object.isNull(this.titleBar.name) || !Object.isNull(this.titleBar.icon);
  protected readonly isIconShown: Signal<boolean> = this.iconShownValue.asReadonly();
  protected readonly isNameShown: Signal<boolean> = this.nameShownValue.asReadonly();
  protected readonly isIdentityShown: Signal<boolean> = computed(() => this.isIconShown() || (!Object.isNull(this.titleBar.name) && this.isNameShown()));
  protected readonly nameWidth: Signal<string | null> = computed(() => {
    const room = this.nameRoom();
    return Object.isNull(room) ? null : Resources.formatPixels(room);
  });
  protected readonly isMac: boolean = this.bridge.isMac;
  protected readonly isDrawingControls: boolean = this.bridge.platform === Resources.linuxPlatform;
  protected readonly bars: BarItemsService = inject(BarItemsService);
  protected readonly menuBar: MenuBarService = inject(MenuBarService);
  protected readonly search: SearchService = inject(SearchService);
  protected readonly palette: SearchPaletteService = inject(SearchPaletteService);
  protected readonly searchKey: Signal<string | null> = computed(() => this.commands.keyLabel(Resources.searchCommand));
  protected readonly fieldShift: Signal<string> = computed(() => Resources.formatPixels(this.shiftValue()));
  protected readonly below: OverlaySide = OverlaySide.below;
  protected readonly leftDockCommand: string = Resources.toggleDockCommands[DockSide.Left];
  protected readonly leftDockGlyph: string = Resources.hideDockGlyphs[DockSide.Left];
  protected readonly isLeftDockShown: Signal<boolean> = computed(() => this.commands.isChecked(this.leftDockCommand));
  protected readonly heading: Signal<DocumentHeading | null> = computed(() => {
    const active = this.layout.layout().documents.active;
    return active instanceof DocumentTab || (active instanceof ViewTab && !Object.isUndefined(active.instance)) ? this.labels.headingOf(active) : null;
  });
  protected readonly isFolded: Signal<boolean> = this.foldedValue.asReadonly();
  protected readonly isFullScreen: Signal<boolean> = this.fullScreenValue.asReadonly();
  protected readonly style: Signal<MenuBarStyle> = computed(() => {
    const value = this.settings.values().get(Resources.menuBarSetting);
    return value === MenuBarStyle.Button || value === MenuBarStyle.Hidden ? value : MenuBarStyle.Inline;
  });
  protected readonly isBarShown: Signal<boolean> = computed(() => !this.isMac && this.style() === MenuBarStyle.Inline && this.menuBar.shownPlaces().length > 0);
  protected readonly isButtonShown: Signal<boolean> = computed(() =>
    !this.isMac && this.menuBar.shownPlaces().length > 0 && (this.style() === MenuBarStyle.Button || (this.style() === MenuBarStyle.Inline && this.isFolded())));

  public constructor() {
    const host = this.host;
    const appearance = inject(AppearanceService);
    inject(LayoutMenuService);
    const covers = inject(DialogCoverService).openDialogs;
    const faded = signal(0);
    let opened: readonly HTMLElement[] = [];
    let closing: readonly HTMLElement[] = [];
    const showing = new MutationObserver(() => faded.update(t => t + 1));
    const overlays = inject(OverlayContainer);
    const leaving = new MutationObserver(() => {
      if (closing.some(t => !t.isConnected))
        faded.update(t => t + 1);
    });
    const backdrops = (): HTMLElement[] => {
      faded();
      const open = [...covers()].flatMap(t => Object.isNull(t.overlayRef.backdropElement) ? [] : [t.overlayRef.backdropElement]);
      for (const backdrop of open)
        showing.observe(backdrop, Resources.backdropShownMutations);
      closing = [...closing, ...opened.filter(t => !open.includes(t))].filter(t => t.isConnected);
      opened = open;
      return [...closing, ...open];
    };
    const ended = (event: TransitionEvent): void => {
      if (event.propertyName === Resources.opacityTransition && [...closing, ...opened].some(t => t === event.target))
        faded.update(t => t + 1);
    };
    host.ownerDocument.addEventListener(Resources.transitionEndEvent, ended);
    inject(DestroyRef).onDestroy(() => {
      host.ownerDocument.removeEventListener(Resources.transitionEndEvent, ended);
      showing.disconnect();
      leaving.disconnect();
    });
    let isReported = false;
    afterNextRender(() => {
      leaving.observe(overlays.getContainerElement(), Resources.overlayHostMutations);
      this.bridge.notifyReady(WindowAppearance.read(host, backdrops()));
    });
    afterRenderEffect(() => {
      appearance.theme();
      appearance.mode();
      const shown = backdrops();
      if (isReported)
        this.bridge.notifyAppearance(WindowAppearance.read(host, shown));
      isReported = true;
    });
    effect(() => {
      host.ownerDocument.title = this.heading()?.windowTitle ?? ProductName.current;
    });
    const loaded = (): void => this.fontLoads.update(t => t + 1);
    host.ownerDocument.fonts.addEventListener(Resources.fontsLoadedEvent, loaded);
    inject(DestroyRef).onDestroy(() => host.ownerDocument.fonts.removeEventListener(Resources.fontsLoadedEvent, loaded));
    const observer = new ResizeObserver(() => this.measure());
    afterRenderEffect(() => {
      this.search.placeholder();
      appearance.typography();
      this.fontLoads();
      observer.disconnect();
      for (const element of [host, this.bar()?.nativeElement, this.menuButton()?.nativeElement, this.start().nativeElement, this.end().nativeElement, this.controls()?.nativeElement, this.middle().nativeElement])
        if (!Object.isUndefined(element))
          observer.observe(element);
    });
    inject(DestroyRef).onDestroy(() => observer.disconnect());
    if (this.isMac) {
      effect(() => this.bridge.setMenuBar(this.menuBar.tree()));
      inject(DestroyRef).onDestroy(this.bridge.onMenuCommand(t => this.menuBar.run(t)));
    }
    if (this.isMac || this.isDrawingControls) {
      inject(DestroyRef).onDestroy(this.bridge.onFullScreen(t => this.fullScreenValue.set(t)));
      void inject(PendingTasks).run(() => this.bridge.readFullScreenAsync().then(t => this.fullScreenValue.set(t), (error: unknown) => this.errors.handleError(error)));
    }
  }

  protected pressed(event: KeyboardEvent): void {
    this.isAltAlone = event.key === Resources.altKey && !event.repeat;
    if (event.key === Resources.functionKey && !event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey)
      this.focusMenu(event);
    else if (event.key === Resources.escapeKey && this.isReturnable(event.target) && !Object.isNull(this.returnFocus))
      this.giveFocusBack(event, this.returnFocus);
  }

  protected pointed(): void {
    this.isAltAlone = false;
  }

  protected released(event: KeyboardEvent): void {
    const isAlone = this.isAltAlone && event.key === Resources.altKey;
    this.isAltAlone = false;
    if (isAlone)
      this.focusMenu(event);
  }

  protected isAvailable(command: string, commandArguments: JsonValue): boolean {
    return this.commands.isAvailable(command, commandArguments);
  }

  protected withKey(command: string, label: string): string {
    return Resources.formatWithKey(label, this.commands.keyLabel(command));
  }

  protected openSearch(): void {
    this.run(Resources.searchCommand, null);
  }

  protected run(command: string, commandArguments: JsonValue): void {
    this.commands.runAsync(command, commandArguments).catch((error: unknown) => this.errors.handleError(error));
  }

  protected runAvailable(command: string, commandArguments: JsonValue): void {
    if (this.isAvailable(command, commandArguments))
      this.run(command, commandArguments);
  }

  private focusMenu(event: Event): void {
    const target = this.isFolded() || this.style() !== MenuBarStyle.Inline
      ? this.menuButton()?.nativeElement
      : this.bar()?.nativeElement.querySelector<HTMLElement>(Resources.menuBarItemSelector);
    if (Object.isNullOrUndefined(target) || this.isMac || this.dialogs.isOpen)
      return;

    event.preventDefault();
    const active = this.host.ownerDocument.activeElement;
    if (!this.host.contains(active))
      this.returnFocus = active instanceof HTMLElement ? active : null;
    target.focus();
  }

  private isReturnable(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && this.host.contains(target) && target.getAttribute(Resources.ariaExpandedAttribute) !== Resources.trueValue;
  }

  private giveFocusBack(event: Event, target: HTMLElement): void {
    event.preventDefault();
    this.returnFocus = null;
    if (target.isConnected)
      target.focus();
  }

  private measure(): void {
    const start = this.start().nativeElement;
    const end = this.end().nativeElement;
    const style = getComputedStyle(this.host);
    const rem = parseFloat(getComputedStyle(this.host.ownerDocument.documentElement).fontSize);
    const controls = this.controls()?.nativeElement;
    const controlsWidth = Object.isUndefined(controls) ? 0 : controls.getBoundingClientRect().width;
    const inner = this.host.getBoundingClientRect().width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
    const room = inner - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - start.getBoundingClientRect().width - end.getBoundingClientRect().width
      - controlsWidth - Resources.windowRowMinimumDragRem * rem;
    const bar = this.bar()?.nativeElement;
    const isFolded = !Object.isUndefined(bar) && WindowRowComponent.outerWidth(bar) > room - Resources.searchFieldMinimumRem * rem;
    this.foldedValue.set(isFolded);
    const menuButton = this.menuButton()?.nativeElement;
    const menu = isFolded || Object.isUndefined(bar) ? (Object.isUndefined(menuButton) ? 0 : WindowRowComponent.outerWidth(menuButton)) : WindowRowComponent.outerWidth(bar);
    this.placeIdentity(room - menu - Resources.searchFieldMinimumRem * rem, rem);
    this.shiftValue.set(this.centringShift());
  }

  private placeIdentity(room: number, rem: number): void {
    const identity = this.identity()?.nativeElement;
    if (Object.isUndefined(identity))
      return;
    const style = getComputedStyle(identity);
    const icon = this.identityIcon()?.nativeElement;
    const end = parseFloat(style.paddingRight);
    const iconWidth = Object.isUndefined(icon) ? 0 : parseFloat(getComputedStyle(icon).width) + parseFloat(style.columnGap);
    const host = this.host.getBoundingClientRect();
    const middle = this.middle().nativeElement;
    const lead = middle.getBoundingClientRect().left + parseFloat(getComputedStyle(middle).paddingLeft) - host.left - identity.getBoundingClientRect().width;
    const centred = host.width / 2 - parseFloat(getComputedStyle(this.host).getPropertyValue(Resources.searchFieldWidthProperty)) * rem / 2 - lead;
    const isIconShown = !Object.isUndefined(icon) && room >= iconWidth + end;
    this.iconShownValue.set(isIconShown);
    const nameRoom = Math.floor(Math.min(room, centred) - end - (isIconShown ? iconWidth : 0));
    this.nameShownValue.set(nameRoom >= Resources.titleBarNameMinimumRem * rem);
    this.nameRoom.set(nameRoom);
  }

  private centringShift(): number {
    const middle = this.middle().nativeElement;
    const box = middle.getBoundingClientRect();
    const host = this.host.getBoundingClientRect();
    const style = getComputedStyle(middle);
    const slack = Math.max((box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - this.field().nativeElement.offsetWidth) / 2, 0);
    const shift = host.left + host.width / 2 - (box.left + box.width / 2);
    return Math.round(Math.min(Math.max(shift, -slack), slack));
  }

  private static outerWidth(element: HTMLElement): number {
    const style = getComputedStyle(element);
    return element.getBoundingClientRect().width + parseFloat(style.marginLeft) + parseFloat(style.marginRight);
  }
}
