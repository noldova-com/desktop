/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgComponentOutlet, NgTemplateOutlet } from "@angular/common";
import { Component, DestroyRef, ElementRef, ErrorHandler, Injector, PendingTasks, type Signal, type Type, type WritableSignal, afterNextRender, computed, effect, inject, signal,
  untracked, viewChild } from "@angular/core";

import "@noldova/context.core";
import { ButtonComponent, ButtonVariant, SelectComponent, SelectOption, TextFieldComponent, TreeComponent, TreeNode } from "@noldova/ui.components.angular";
import type { JsonValue } from "@noldova/context.json";
import { DatePattern, type SettingDefinition, SettingKind } from "@noldova/desktop.protocol";

import { UpdateStateKind } from "../../enums/update-state-kind.js";
import { GalleryTokens } from "../../models/gallery-tokens.js";
import { SettingsPage } from "../../models/settings/settings-page.js";
import type { SettingsPageEntry } from "../../models/settings/settings-page-entry.js";
import type { SettingsRow } from "../../models/settings/settings-row.js";
import { ShortcutRow } from "../../models/settings/shortcut-row.js";
import { TextMatch } from "../../models/settings/text-match.js";
import { Resources } from "../../../resources.js";
import { ClockSettingService } from "../../services/clock-setting.service.js";
import { CommandService } from "../../services/command.service.js";
import { PaneKeysService } from "../../services/pane-keys.service.js";
import { PreloadBridgeService } from "../../services/preload-bridge.service.js";
import { ModuleStatusService } from "../../services/module-status.service.js";
import { SettingsPageService } from "../../services/settings-page.service.js";
import { ModuleSwitchService } from "../../services/module-switch.service.js";
import { SettingCheckService } from "../../services/setting-check.service.js";
import { SettingOptionsService } from "../../services/setting-options.service.js";
import { WindowPartHostService } from "../../services/window-part-host.service.js";
import { SettingsService } from "../../services/settings.service.js";
import { SpellingService } from "../../services/spelling.service.js";
import { UpdateService } from "../../services/update.service.js";
import { AboutComponent } from "../about/about.component.js";
import { HighlightedTextComponent } from "../highlighted-text/highlighted-text.component.js";
import { RuntimeStatusComponent } from "../runtime-status/runtime-status.component.js";
import { SettingRowComponent } from "../setting-row/setting-row.component.js";
import { SettingsPageHostComponent } from "../settings-page-host/settings-page-host.component.js";
import { ShortcutsComponent } from "../shortcuts/shortcuts.component.js";

@Component({
  selector: "nol-settings",
  imports: [AboutComponent, ButtonComponent, HighlightedTextComponent, NgComponentOutlet, NgTemplateOutlet, RuntimeStatusComponent, SelectComponent, SettingRowComponent, SettingsPageHostComponent, ShortcutsComponent, TextFieldComponent,
    TreeComponent],
  templateUrl: "./settings.component.html",
  styleUrl: "./settings.component.css",
  host: {
    "class": "nol-settings",
    "(focusin)": "noteFocus($event)",
    "(focusout)": "noteBlur()"
  }
})
export class SettingsComponent {
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly switches: ModuleSwitchService = inject(ModuleSwitchService);
  private readonly commands: CommandService = inject(CommandService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);
  private readonly clock: ClockSettingService = inject(ClockSettingService);
  private readonly selected: WritableSignal<string> = signal(Resources.generalPage);
  private readonly pageList: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("pageList");
  private readonly column: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("column");
  private readonly pageTree: Signal<TreeComponent> = viewChild.required(TreeComponent);
  private readonly pageSelect: Signal<ElementRef<HTMLElement>> = viewChild.required("pageSelect", { read: ElementRef<HTMLElement> });
  private readonly pageChooser: Signal<SelectComponent> = viewChild.required("pageSelect", { read: SelectComponent });
  private readonly isTrayAvailable: WritableSignal<boolean> = signal(true);
  private readonly drafts: WritableSignal<ReadonlyMap<string, readonly [string, string]>> = signal(new Map());
  private readonly now: Date = new Date();
  private focusedControl: HTMLElement | null = null;
  private readonly injector = inject(Injector);
  private marked: Element | null = null;
  private revealer: MutationObserver | null = null;
  private readonly statuses: ModuleStatusService = inject(ModuleStatusService);
  private readonly updates: UpdateService = inject(UpdateService);
  private readonly parts: WindowPartHostService = inject(WindowPartHostService);
  private readonly paneKeys: PaneKeysService = inject(PaneKeysService);
  private readonly offeredDefinitions: Signal<readonly SettingDefinition[]> = computed(() => {
    const definitions = this.settings.definitions().flatMap(t => t.name.text === Resources.timeFormatSetting ? [this.clock.definition, t] : [t]);
    return this.updates.state().kind === UpdateStateKind.Off ? definitions.filter(t => t.page !== Resources.aboutPage) : definitions;
  });
  private readonly currentTitle: Signal<string> = computed(() =>
    [this.selected(), Resources.generalPage].map(t => this.pages().find(u => u.title === t || u.entry?.name === t)).find(t => !Object.isUndefined(t))?.title ?? Resources.appearancePage);

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly query: WritableSignal<string> = signal(String.empty);
  protected readonly gallery: Type<unknown> | null = inject(GalleryTokens.component);
  protected readonly spelling: SpellingService = inject(SpellingService);
  protected readonly settingOptions: SettingOptionsService = inject(SettingOptionsService);
  protected readonly settingChecks: SettingCheckService = inject(SettingCheckService);
  protected readonly modules: Signal<readonly SelectOption[]> = computed(() => this.statuses.modules().map(t => new SelectOption(t.id, t.displayName)));
  protected readonly notifyingModules: Signal<readonly SelectOption[]> = computed(() =>
    this.statuses.notifying().map(t => new SelectOption(t.id, Resources.formatModuleNotifications(t.displayName))));
  protected readonly values: Signal<ReadonlyMap<string, JsonValue>> = computed(() => new Map([...this.settings.values(), [Resources.clockSetting, this.clock.value()]]));
  protected readonly setFlags: Signal<ReadonlyMap<string, Signal<boolean>>> = computed(() =>
    new Map([...this.settings.definitions().map(t => [t.name.text, this.settings.isSet(t.name.text)] as const), [Resources.clockSetting, this.clock.isSet]]));
  protected readonly isSearching: Signal<boolean> = computed(() => this.query().trim().length > 0);
  protected readonly pages: Signal<readonly SettingsPage[]> = computed(() =>
    SettingsPage.pagesOf(this.offeredDefinitions(), Object.isNull(this.gallery) ? [] : [SettingsPage.galleryOf(Resources.galleryPage)], this.parts.settingsPages()));
  protected readonly currentPage: Signal<SettingsPage | undefined> = computed(() => this.pages().find(t => t.title === this.currentTitle()));
  protected readonly pageNodes: Signal<readonly TreeNode[]> = computed(() => this.pages().map(t => new TreeNode(t.title, t.title)));
  protected readonly pageOptions: Signal<readonly SelectOption[]> = computed(() => this.pages().map(t => new SelectOption(t.title, t.title)));
  protected readonly pageChoice: Signal<string> = computed(() => this.isSearching() ? Resources.settingsSearchResults : this.currentTitle());
  protected readonly shortcuts: Signal<readonly ShortcutRow[]> = computed(() => {
    const map = this.commands.shortcuts();
    const bindings = this.commands.bindings();
    const paneKeys = this.paneKeys.keys();
    return this.commands.commands().map(command => {
      const collision = map.collisions.find(t => t.refused === command.name);
      const key = this.commands.keyLabel(command.name);
      const chord = map.keyOf(command.name);
      const notes = Object.isNull(chord) ? [] : [...new Set(paneKeys.filter(t => t[1].isSameOn(chord, this.bridge.platform)).map(t => this.statuses.nameOf(t[0])))]
        .map(t => Resources.formatKeyTakenInPages(chord.label(this.bridge.platform), t));
      return new ShortcutRow(command.name, command.title, this.commands.ownerOf(command.name), key ?? Resources.noKey, !Object.isNull(key), bindings.has(command.name),
        Object.isUndefined(collision) ? null : Resources.formatKeyTaken(collision.key.label(this.bridge.platform), this.commands.titleOf(collision.keptBy)),
        notes.length === 0 ? null : notes.join(Resources.paneNoteSeparator));
    });
  });
  protected readonly results: Signal<readonly SettingsPage[]> = computed(() => {
    const query = this.query();
    return this.pages()
      .map(t => t.isShortcuts ? t : t.filter(u => SettingsComponent.matches(u, query)))
      .filter(t => t.isShortcuts ? this.matchingShortcuts().length > 0 : t.groups.length > 0 || (!Object.isNull(t.entry) && (TextMatch.contains(t.title, query) || this.matchingRows(t.entry).length > 0)));
  });
  protected readonly matchingShortcuts: Signal<readonly ShortcutRow[]> = computed(() => {
    const query = this.query();
    return this.isSearching() ? this.shortcuts().filter(t => [t.title, t.name, t.owner, t.key].some(u => TextMatch.contains(u, query))) : this.shortcuts();
  });

  public constructor() {
    const destroyRef = inject(DestroyRef);
    const requests = inject(SettingsPageService);
    effect(() => {
      const page = requests.requested();
      if (Object.isNull(page))
        return;
      untracked(() => {
        const setting = requests.take();
        this.select(page);
        if (!Object.isNull(setting))
          afterNextRender(() => this.reveal(setting), { injector: this.injector });
      });
    });
    destroyRef.onDestroy(this.bridge.onTrayAvailable(t => this.isTrayAvailable.set(t)));
    destroyRef.onDestroy(() => this.unmark());
    void inject(PendingTasks).run(() => this.bridge.readTrayAvailableAsync().then(t => this.isTrayAvailable.set(t), (error: unknown) => this.errors.handleError(error)));
    afterNextRender(() => {
      const switched = new ResizeObserver(() => this.keepFocus());
      switched.observe(this.pageList().nativeElement);
      switched.observe(this.pageSelect().nativeElement);
      destroyRef.onDestroy(() => switched.disconnect());
    });
  }

  protected noteFocus(event: FocusEvent): void {
    const path = event.composedPath();
    this.focusedControl = [this.pageList().nativeElement, this.pageSelect().nativeElement].find(t => path.includes(t)) ?? null;
  }

  protected noteBlur(): void {
    if (this.focusedControl?.checkVisibility() && !this.pageChooser().isExpanded())
      this.focusedControl = null;
  }

  protected search(event: Event): void {
    if (!(event.target instanceof HTMLInputElement))
      return;
    this.unmark();
    this.query.set(event.target.value);
  }

  protected select(title: string): void {
    this.unmark();
    this.query.set(String.empty);
    this.selected.set(title);
  }

  protected matchingRows(entry: SettingsPageEntry): readonly SettingsRow[] {
    const query = this.query();
    return entry.rows.filter(t => [t.title, t.description].some(u => !Object.isNull(u) && TextMatch.contains(u, query)));
  }

  protected openPage(page: string): void {
    this.select(page);
    afterNextRender(() => this.focusControl(this.column().nativeElement.querySelector<HTMLElement>(Resources.settingControlSelector)), { injector: this.injector });
  }

  protected openRow(page: string, id: string): void {
    this.select(page);
    afterNextRender(() => this.reveal(id), { injector: this.injector });
  }

  protected isMutedModules(definition: SettingDefinition): boolean {
    return definition.name.text === Resources.mutedModulesSetting;
  }

  protected noteFor(definition: SettingDefinition): string | null {
    const name = definition.name.text;
    if (definition.type.kind === SettingKind.Languages)
      return this.spelling.noteFor(this.values().get(name));
    if (this.isFormat(definition)) {
      const stored = this.storedText(definition);
      const [text, base] = this.drafts().get(name) ?? [stored, stored];
      return Resources.formatPatternPreview(DatePattern.format(this.now, base === stored ? text : stored));
    }
    return definition.name.text === Resources.trayIconSetting && !this.isTrayAvailable() ? Resources.noTrayHostNote : null;
  }

  protected isFormat(definition: SettingDefinition): boolean {
    return definition.name.text === Resources.timeFormatSetting || definition.name.text === Resources.dateTimeFormatSetting;
  }

  protected draft(definition: SettingDefinition, text: string): void {
    this.drafts.update(t => new Map([...t, [definition.name.text, [text, this.storedText(definition)] as const]]));
  }

  protected change(definition: SettingDefinition, value: JsonValue): void {
    this.dropDraft(definition);
    const changing = definition === this.clock.definition ? this.clock.chooseAsync(value) : this.switches.setAsync(definition.name.text, value);
    changing.catch((error: unknown) => this.errors.handleError(error));
  }

  protected reset(definition: SettingDefinition): void {
    this.dropDraft(definition);
    this.focusControl(this.column().nativeElement.querySelector<HTMLElement>(Resources.formatSettingRowControlSelector(definition.name.text)));
    const resetting = definition === this.clock.definition ? this.clock.resetAsync() : this.switches.resetAsync(definition);
    resetting.catch((error: unknown) => this.errors.handleError(error));
  }

  protected canRun(definition: SettingDefinition): boolean {
    return definition.type.kind === SettingKind.Action && this.commands.isAvailable(String(definition.type.command));
  }

  protected run(definition: SettingDefinition): void {
    this.commands.run(String(definition.type.command));
  }

  private reveal(id: string): void {
    const column = this.column().nativeElement;
    const find = (): boolean => {
      const row = column.querySelector(Resources.formatAttributeSelector(Resources.settingAttribute, CSS.escape(id)));
      if (Object.isNull(row))
        return false;
      row.scrollIntoView({ block: Resources.foundRowBlock });
      row.classList.add(Resources.foundRowClass);
      this.marked = row;
      for (const control of [...row.querySelectorAll<HTMLElement>(Resources.settingControlSelector)].slice(0, 1))
        control.focus();
      return true;
    };
    if (find())
      return;
    const revealer = new MutationObserver(() => {
      if (find())
        revealer.disconnect();
    });
    revealer.observe(column, { childList: true, subtree: true });
    this.revealer = revealer;
  }

  private focusControl(control: HTMLElement | null): void {
    if (Object.isNull(control))
      this.focusPages();
    else
      control.focus();
  }

  private focusPages(): void {
    if (this.pageList().nativeElement.checkVisibility())
      this.pageTree().focus();
    else
      this.pageChooser().focus();
  }

  private unmark(): void {
    this.revealer?.disconnect();
    this.marked?.classList.remove(Resources.foundRowClass);
    this.revealer = null;
    this.marked = null;
  }

  private storedText(definition: SettingDefinition): string {
    return String(this.values().get(definition.name.text) ?? definition.defaultValue);
  }

  private dropDraft(definition: SettingDefinition): void {
    this.drafts.update(t => new Map([...t].filter(([name]) => name !== definition.name.text)));
  }

  private keepFocus(): void {
    const list = this.pageList().nativeElement;
    const select = this.pageSelect().nativeElement;
    const hidden = list.checkVisibility() ? select : list;
    const active = document.activeElement;
    if (this.focusedControl !== hidden || !(active === document.body || hidden.contains(active) || this.pageChooser().isExpanded()))
      return;
    this.focusPages();
  }

  private static matches(definition: SettingDefinition, query: string): boolean {
    return [definition.title, definition.description, definition.name.text, definition.type.label].some(t => !Object.isNull(t) && TextMatch.contains(t, query));
  }
}
