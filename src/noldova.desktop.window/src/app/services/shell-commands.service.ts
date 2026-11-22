/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { EnvironmentInjector, Injectable, afterNextRender, inject } from "@angular/core";

import "@noldova/context.core";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { EditAction, type KeyChord, LinkPolicy, ShellKeys } from "@noldova/desktop.protocol";

import { BottomDockSpan } from "../enums/bottom-dock-span.js";
import { DockSide } from "../enums/dock-side.js";
import { LinkPlace } from "../enums/link-place.js";
import { PanelEdge } from "../enums/panel-edge.js";
import { ToolbarMove } from "../enums/toolbar-move.js";
import { UpdateAction } from "../enums/update-action.js";
import { UpdateStateKind } from "../enums/update-state-kind.js";
import { CommandContribution } from "../models/command-contribution.js";
import { SideDropTarget } from "../models/layout/side-drop-target.js";
import { SplitDropTarget } from "../models/layout/split-drop-target.js";
import type { Tab } from "../models/layout/tab.js";
import type { TabGroup } from "../models/layout/tab-group.js";
import { TabDropTarget } from "../models/layout/tab-drop-target.js";
import { TabKey } from "../models/layout/tab-key.js";
import { ViewTab } from "../models/layout/view-tab.js";
import { SearchRequest } from "../models/search-request.js";
import { ShellDocuments } from "../models/shell-documents.js";
import { TabTarget } from "../models/tab-target.js";
import { TabMove } from "../models/tab-move.js";
import { FocusableGroup } from "../models/focusable-group.js";
import { ProductName } from "../models/product-name.js";
import { Resources } from "../../resources.js";
import { SearchPaletteService } from "./search-palette.service.js";
import { DocumentHistoryService } from "./document-history.service.js";
import { PreloadBridgeService } from "./preload-bridge.service.js";
import { EditTargetService } from "./edit-target.service.js";
import { LinkService } from "./link.service.js";
import { LayoutService } from "./layout.service.js";
import { RegionFocusService } from "./region-focus.service.js";
import { SettingsPageService } from "./settings-page.service.js";
import { SupportService } from "./support.service.js";
import { TabFocusService } from "./tab-focus.service.js";
import { TabRenameService } from "./tab-rename.service.js";
import { ToolbarService } from "./toolbar.service.js";
import { TabStripService } from "./tab-strip.service.js";
import { UpdateService } from "./update.service.js";
import { ViewDialogService } from "./view-dialog.service.js";
import { ViewInstancesService } from "./view-instances.service.js";

@Injectable({ providedIn: "root" })
export class ShellCommandsService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly strips: TabStripService = inject(TabStripService);
  private readonly search: SearchPaletteService = inject(SearchPaletteService);
  private readonly history: DocumentHistoryService = inject(DocumentHistoryService);
  private readonly edits: EditTargetService = inject(EditTargetService);
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);
  private readonly links: LinkService = inject(LinkService);
  private readonly viewDialogs: ViewDialogService = inject(ViewDialogService);
  private readonly instances: ViewInstancesService = inject(ViewInstancesService);
  private readonly tabFocus: TabFocusService = inject(TabFocusService);
  private readonly renames: TabRenameService = inject(TabRenameService);
  private readonly regions: RegionFocusService = inject(RegionFocusService);
  private readonly settingsPages: SettingsPageService = inject(SettingsPageService);
  private readonly updates: UpdateService = inject(UpdateService);
  private readonly support: SupportService = inject(SupportService);
  private readonly document: Document = inject(DOCUMENT);
  private readonly environment: EnvironmentInjector = inject(EnvironmentInjector);

  public readonly commands: readonly CommandContribution[] = [
    this.tabCommand(Resources.closeTabCommand, Resources.closeTabTitle, Resources.closeGlyph, t => this.close(t), () => true),
    this.tabCommand(Resources.keepTabCommand, Resources.keepTabTitle, Resources.keepGlyph, t => this.layout.keep(t.tab), t => t.isPreview, t => t.isPreview),
    this.tabCommand(Resources.renameTabCommand, Resources.renameTabTitle, Resources.renameGlyph, t => this.renames.begin(t.tab), t => this.renames.canRename(t.tab),
      t => this.renames.canRename(t.tab)),
    this.tabCommand(Resources.closeOtherTabsCommand, Resources.closeOtherTabsTitle, Resources.closeOthersGlyph,
      t => this.closeKeeping(t.group.tabs.filter(u => !u.equals(t.tab)), t.tab), t => t.group.tabs.length > 1),
    this.tabCommand(Resources.closeTabsToTheRightCommand, Resources.closeTabsToTheRightTitle, Resources.closeToTheRightGlyph,
      t => this.closeKeeping(t.group.tabs.slice(t.index + 1), t.tab), t => !t.isLast),
    this.tabCommand(Resources.closeAllTabsCommand, Resources.closeAllTabsTitle, Resources.closeAllGlyph, t => this.closeAll(t), () => true),
    this.tabCommand(Resources.moveTabLeftCommand, Resources.moveTabLeftTitle, Resources.moveEarlierGlyph,
      t => this.place(t.tab, new TabDropTarget(t.group.id, t.index - 1)), t => !t.isFirst),
    this.tabCommand(Resources.moveTabRightCommand, Resources.moveTabRightTitle, Resources.moveLaterGlyph,
      t => this.place(t.tab, new TabDropTarget(t.group.id, t.index + 2)), t => !t.isLast),
    this.tabCommand(Resources.nextTabCommand, Resources.nextTabTitle, Resources.nextTabGlyph, t => this.show(t, 1), t => t.group.tabs.length > 1),
    this.tabCommand(Resources.previousTabCommand, Resources.previousTabTitle, Resources.previousTabGlyph, t => this.show(t, -1), t => t.group.tabs.length > 1),
    ...Object.values(PanelEdge).map(edge => this.tabCommand(Resources.splitTabCommands[edge], Resources.splitTabTitles[edge], Resources.splitGlyphs[edge],
      t => this.place(t.tab, new SplitDropTarget(t.group.id, edge)), t => t.canSplit)),
    ...Object.values(DockSide).map(side => this.tabCommand(Resources.dockTabCommands[side], Resources.dockTabTitles[side], Resources.dockGlyphs[side],
      t => this.place(t.tab, new SideDropTarget(side)), t => t.tab.isMovable, t => t.tab.isMovable)),
    new CommandContribution(Resources.moveTabToGroupCommand, Resources.moveTabToGroupTitle, Resources.moveToGlyph, null,
      commandArguments => this.done(() => {
        const move = this.moveOf(commandArguments);
        if (!Object.isNull(move))
          this.place(move.target.tab, new TabDropTarget(move.group.id, move.group.tabs.length));
      }),
      commandArguments => !Object.isNull(this.moveOf(commandArguments)), null,
      commandArguments => !Object.isNull(this.targetOf(commandArguments))),
    this.tabCommand(Resources.moveTabToNextGroupCommand, Resources.moveTabToNextGroupTitle, Resources.moveToGlyph, t => this.moveToGroup(t, 1), t => this.neighborOf(t, 1).length > 0,
      t => this.neighborOf(t, 1).length > 0),
    this.tabCommand(Resources.moveTabToPreviousGroupCommand, Resources.moveTabToPreviousGroupTitle, Resources.moveToGlyph, t => this.moveToGroup(t, -1), t => this.neighborOf(t, -1).length > 0,
      t => this.neighborOf(t, -1).length > 0),
    new CommandContribution(Resources.focusNextGroupCommand, Resources.focusNextGroupTitle, Resources.focusNextGroupGlyph, null, () => this.done(() => this.focusGroup(1)), () => this.focusable().length > 1),
    new CommandContribution(Resources.focusPreviousGroupCommand, Resources.focusPreviousGroupTitle, Resources.focusPreviousGroupGlyph, null, () => this.done(() => this.focusGroup(-1)),
      () => this.focusable().length > 1),
    new CommandContribution(Resources.focusNextRegionCommand, Resources.focusNextRegionTitle, Resources.focusNextRegionGlyph, null, () => this.done(() => this.regions.move(1)),
      () => this.regions.hasStops()),
    new CommandContribution(Resources.focusPreviousRegionCommand, Resources.focusPreviousRegionTitle, Resources.focusPreviousRegionGlyph, null, () => this.done(() => this.regions.move(-1)),
      () => this.regions.hasStops()),
    ...Object.values(DockSide).map(side => new CommandContribution(Resources.toggleDockCommands[side], Resources.toggleDockTitles[side], Resources.hideDockGlyphs[side], null,
      () => this.done(() => this.layout.toggleDock(side)), () => true, () => this.layout.layout().dock(side).isExpanded && !this.layout.geometry().closedSides.has(side))),
    ...Object.values(EditAction).map(action => new CommandContribution(Resources.editCommands[action], Resources.editTitles[action], Resources.editGlyphs[action], null,
      () => this.editAsync(action), () => this.edits.canRun(action))),
    new CommandContribution(Resources.replaceMisspellingCommand, Resources.replaceMisspellingTitle, null, null,
      commandArguments => this.replaceMisspellingAsync(commandArguments), commandArguments => !Object.isNull(ShellCommandsService.textOf(commandArguments, Resources.textArgument))),
    new CommandContribution(Resources.addToDictionaryCommand, Resources.addToDictionaryTitle, Resources.addToDictionaryGlyph, null,
      commandArguments => this.addToDictionaryAsync(commandArguments), commandArguments => !Object.isNull(ShellCommandsService.textOf(commandArguments, Resources.wordArgument))),
    new CommandContribution(Resources.openLinkInAppCommand, Resources.formatOpenLinkInAppTitle(ProductName.current), Resources.openLinkInAppGlyph, null,
      commandArguments => this.openLinkAsync(commandArguments, LinkPlace.InApp), commandArguments => this.opensInApp(commandArguments), null,
      commandArguments => this.opensInApp(commandArguments)),
    new CommandContribution(Resources.openLinkInBrowserCommand, Resources.openLinkInBrowserTitle, Resources.openLinkInBrowserGlyph, null,
      commandArguments => this.openLinkAsync(commandArguments, LinkPlace.System), commandArguments => !Object.isNull(ShellCommandsService.webUrlOf(commandArguments)), null,
      commandArguments => !Object.isNull(ShellCommandsService.webUrlOf(commandArguments))),
    new CommandContribution(Resources.searchCommand, Resources.searchTitle, Resources.searchGlyph, null,
      commandArguments => this.done(() => this.search.open(new SearchRequest(String.empty, ShellCommandsService.textOf(commandArguments, Resources.sourceArgument))))),
    new CommandContribution(Resources.showCommandsCommand, Resources.showCommandsTitle, Resources.showCommandsGlyph, null,
      () => this.done(() => this.search.open(SearchRequest.commands))),
    new CommandContribution(Resources.openSettingsCommand, Resources.openSettingsTitle, Resources.settingsGlyph, null,
      commandArguments => this.done(() => this.openSettings(commandArguments)),
      () => this.layout.registry().hasDocument(ShellDocuments.settings.name)),
    new CommandContribution(Resources.showShortcutsCommand, Resources.showShortcutsTitle, Resources.showShortcutsGlyph, null,
      () => this.done(() => this.settingsPages.open(Resources.shortcutsPage)),
      () => this.layout.registry().hasDocument(ShellDocuments.settings.name)),
    new CommandContribution(Resources.installCommandCommand, Resources.installCommandTitle, Resources.installCommandGlyph, null,
      () => this.bridge.installCommandAsync(), () => this.bridge.isMac, null, () => this.bridge.isMac),
    new CommandContribution(Resources.checkForUpdatesCommand, Resources.checkForUpdatesTitle, Resources.checkForUpdatesGlyph, null,
      () => this.done(() => this.updates.act(UpdateAction.Check)), () => this.updates.state().canCheck, null,
      () => this.updates.state().kind !== UpdateStateKind.Off),
    new CommandContribution(Resources.restartToUpdateCommand, Resources.restartToUpdateTitle, Resources.restartToUpdateGlyph, null,
      () => this.done(() => this.updates.act(UpdateAction.Restart)), () => this.updates.state().canRestart, null, () => this.updates.state().canRestart),
    new CommandContribution(Resources.openLogFolderCommand, Resources.openLogFolderLabel, Resources.logFolderGlyph, null, () => this.support.openLogFolderAsync()),
    new CommandContribution(Resources.copyDetailsCommand, Resources.copyDetailsLabel, Resources.copyGlyph, null, () => this.support.copyDetailsAsync()),
    new CommandContribution(Resources.openModulesCommand, Resources.openModulesTitle, Resources.modulesGlyph, null,
      () => this.done(() => this.layout.openDocument(ShellDocuments.modulesTab)),
      () => this.layout.registry().hasDocument(ShellDocuments.modules.name)),
    new CommandContribution(Resources.showInDialogCommand, Resources.showInDialogTitle, Resources.showInDialogGlyph, null,
      commandArguments => this.showInDialogAsync(commandArguments),
      commandArguments => !Object.isNull(this.shownTabOf(commandArguments))),
    new CommandContribution(Resources.toggleToolbarCommand, Resources.toggleToolbarTitle, Resources.focusToolbarsGlyph, null,
      commandArguments => this.done(() => {
        const name = this.toolbarOf(commandArguments);
        if (!Object.isNull(name))
          this.toolbars.setShown(name, !this.toolbars.isShown(name));
      }),
      commandArguments => !Object.isNull(this.toolbarOf(commandArguments)),
      commandArguments => {
        const name = this.toolbarOf(commandArguments);
        return !Object.isNull(name) && this.toolbars.isShown(name);
      }),
    ...Object.values(ToolbarMove).map(move => new CommandContribution(Resources.moveToolbarCommands[move], Resources.moveToolbarTitles[move], Resources.moveToolbarGlyphs[move], null,
      commandArguments => this.done(() => {
        const name = this.toolbarOf(commandArguments);
        if (!Object.isNull(name)) {
          this.toolbars.moveBy(name, move);
          this.focusGrip(name);
        }
      }),
      commandArguments => {
        const name = this.toolbarOf(commandArguments);
        return !Object.isNull(name) && this.toolbars.canMove(name, move);
      })),
    new CommandContribution(Resources.hideToolbarCommand, Resources.hideToolbarTitle, Resources.hideToolbarGlyph, null,
      commandArguments => this.done(() => {
        const name = this.toolbarOf(commandArguments);
        if (!Object.isNull(name)) {
          const index = this.gripsOf().findIndex(t => t.closest<HTMLElement>(Resources.toolbarSelector)?.dataset[Resources.toolbarData] === name);
          this.toolbars.setShown(name, false);
          this.focusAfterHide(index);
        }
      }),
      commandArguments => !Object.isNull(this.toolbarOf(commandArguments))),
    new CommandContribution(Resources.focusToolbarsCommand, Resources.focusToolbarsTitle, Resources.focusToolbarsGlyph, null,
      () => this.done(() => this.focusToolbars()), () => this.toolbars.hasContent()),
    new CommandContribution(Resources.goBackCommand, Resources.goBackTitle, Resources.goBackGlyph, null, () => this.done(() => this.history.go(-1)), () => this.history.canGoBack()),
    new CommandContribution(Resources.goForwardCommand, Resources.goForwardTitle, Resources.goForwardGlyph, null, () => this.done(() => this.history.go(1)),
      () => this.history.canGoForward()),
    new CommandContribution(Resources.toggleViewCommand, Resources.toggleViewTitle, Resources.toggleViewGlyph, null,
      commandArguments => this.done(() => {
        const tab = this.viewOf(commandArguments);
        if (!Object.isNull(tab))
          this.toggleView(tab);
      }),
      commandArguments => !Object.isNull(this.viewOf(commandArguments)),
      commandArguments => {
        const tab = this.viewOf(commandArguments);
        return !Object.isNull(tab) && this.layout.layout().isOpen(tab);
      }),
    new CommandContribution(Resources.resetLayoutCommand, Resources.resetLayoutLabel, Resources.resetLayoutGlyph, null, () => this.done(() => this.layout.reset())),
    ...Object.values(BottomDockSpan).map(span => new CommandContribution(Resources.bottomSpanCommands[span], Resources.bottomSpanLabels[span], Resources.bottomSpanGlyphs[span], null,
      () => this.done(() => this.layout.setBottomSpan(span)), () => true, () => this.layout.layout().bottomSpan === span)),
    new CommandContribution(Resources.showAllTabsCommand, Resources.overflowLabel, Resources.overflowGlyph, null,
      commandArguments => this.done(() => {
        const group = this.groupOf(commandArguments);
        if (!Object.isNull(group) && this.strips.isOverflowing(group))
          this.strips.showList(group);
      }),
      commandArguments => {
        const group = this.groupOf(commandArguments);
        return !Object.isNull(group) && this.strips.isOverflowing(group);
      })
  ];

  private get toolbars(): ToolbarService {
    return this.environment.get(ToolbarService);
  }

  public keys(platform: string): readonly (readonly [KeyChord, string])[] {
    return [...ShellKeys.list(platform), ...ShellKeys.declarable(platform), ...ShellKeys.pageFirst(platform)];
  }

  public pageFirstKeys(platform: string): readonly KeyChord[] {
    return ShellKeys.pageFirst(platform).map(t => t[0]);
  }

  private openSettings(commandArguments: JsonValue): void {
    const page = Object.isNull(commandArguments) ? undefined : JsonReader.fromValue(commandArguments).readOptionalString(Resources.pageArgument);
    if (Object.isUndefined(page))
      this.layout.openDocument(ShellDocuments.settingsTab);
    else
      this.settingsPages.open(page);
  }

  private tabCommand(name: string, title: string, icon: string, run: (target: TabTarget) => void, isEnabled: (target: TabTarget) => boolean,
    isApplicable: (target: TabTarget) => boolean = ShellCommandsService.always): CommandContribution {
    const holds = (commandArguments: JsonValue, rule: (target: TabTarget) => boolean): boolean => {
      const target = this.targetOf(commandArguments);
      return !Object.isNull(target) && rule(target);
    };
    return new CommandContribution(name, title, icon, null,
      commandArguments => this.done(() => {
        const target = this.targetOf(commandArguments);
        if (!Object.isNull(target) && isEnabled(target))
          run(target);
      }),
      commandArguments => holds(commandArguments, isEnabled), null,
      commandArguments => holds(commandArguments, isApplicable));
  }

  private static always(): boolean {
    return true;
  }

  private moveOf(commandArguments: JsonValue): TabMove | null {
    const target = this.targetOf(commandArguments);
    if (Object.isNull(target) || Object.isNull(commandArguments))
      return null;
    const reader = JsonReader.fromValue(commandArguments);
    const group = reader.hasField(Resources.groupArgument) ? this.layout.layout().group(reader.readInteger(Resources.groupArgument)) : null;
    return Object.isNull(group) || !group.accepts(target.tab) || group.has(target.tab) ? null : new TabMove(target, group);
  }

  private targetOf(commandArguments: JsonValue): TabTarget | null {
    const layout = this.layout.layout();
    const key = this.tabKeyOf(commandArguments);
    const tab = Object.isUndefined(key) ? this.layout.currentGroup().active : layout.groups.flatMap(t => t.tabs).find(t => t.key === key) ?? null;
    const group = Object.isNull(tab) ? null : layout.groupOf(tab);
    return Object.isNull(tab) || Object.isNull(group) ? null : new TabTarget(tab, group, layout.canSplit(tab, group.id));
  }

  private shownTabOf(commandArguments: JsonValue): Tab | null {
    const key = this.tabKeyOf(commandArguments);
    const tab = Object.isUndefined(key) ? null : TabKey.parse(key);
    return !Object.isNull(tab) && this.viewDialogs.canShow(tab) ? tab : null;
  }

  private async showInDialogAsync(commandArguments: JsonValue): Promise<JsonValue> {
    const tab = this.shownTabOf(commandArguments);
    if (!Object.isNull(tab))
      await this.viewDialogs.showAsync(tab);
    return null;
  }

  private toolbarOf(commandArguments: JsonValue): string | null {
    const name = Object.isNull(commandArguments) ? undefined : JsonReader.fromValue(commandArguments).readOptionalString(Resources.toolbarArgument);
    return !Object.isUndefined(name) && this.toolbars.isKnown(name) ? name : null;
  }

  private viewOf(commandArguments: JsonValue): ViewTab | null {
    const name = ShellCommandsService.textOf(commandArguments, Resources.viewArgument);
    return !Object.isNull(name) && this.layout.registry().hasView(name) && !this.layout.registry().view(name).hasInstances ? new ViewTab(name) : null;
  }

  private toggleView(tab: ViewTab): void {
    if (this.layout.layout().isOpen(tab)) {
      this.layout.close(tab);
      return;
    }
    this.instances.reveal(tab);
  }

  private focusGrip(name: string): void {
    afterNextRender(() => [...this.document.querySelectorAll<HTMLElement>(Resources.toolbarSelector)]
      .find(t => t.dataset[Resources.toolbarData] === name)?.querySelector<HTMLElement>(Resources.toolbarGripSelector)?.focus(), { injector: this.environment });
  }

  private gripsOf(): readonly HTMLElement[] {
    return [...this.document.querySelectorAll<HTMLElement>(Resources.toolbarGripSelector)];
  }

  private focusAfterHide(index: number): void {
    afterNextRender(() => {
      const grips = this.gripsOf();
      (grips[index] ?? grips.at(-1) ?? this.document.querySelector<HTMLElement>(Resources.searchFieldSelector))?.focus();
    }, { injector: this.environment });
  }

  private focusToolbars(): void {
    this.document.querySelector<HTMLElement>(Resources.toolbarItemSelector)?.focus();
  }

  private groupOf(commandArguments: JsonValue): number | null {
    return Object.isUndefined(this.tabKeyOf(commandArguments)) ? this.layout.currentGroup().id : this.targetOf(commandArguments)?.group.id ?? null;
  }

  private tabKeyOf(commandArguments: JsonValue): string | undefined {
    return Object.isNull(commandArguments) ? undefined : JsonReader.fromValue(commandArguments).readOptionalString(Resources.tabArgument);
  }

  private neighborOf(target: TabTarget, step: number): readonly TabGroup[] {
    const groups = this.layout.layout().groups.filter(t => t.accepts(target.tab));
    const next = (groups.findIndex(t => t.id === target.group.id) + step + groups.length) % groups.length;
    return groups.length < 2 ? [] : groups.slice(next, next + 1);
  }

  private moveToGroup(target: TabTarget, step: number): void {
    for (const group of this.neighborOf(target, step))
      this.place(target.tab, new TabDropTarget(group.id, group.tabs.length));
  }

  private focusable(): readonly FocusableGroup[] {
    return this.layout.geometry().frames.flatMap(t => Object.isNull(t.group.active) ? [] : [new FocusableGroup(t.group, t.group.active)]);
  }

  private focusGroup(step: number): void {
    const groups = this.focusable();
    const next = (groups.findIndex(t => t.group.id === this.layout.currentGroup().id) + step + groups.length) % groups.length;
    for (const focusable of groups.slice(next, next + 1)) {
      this.layout.focusGroup(focusable.group.id);
      this.tabFocus.focus(focusable.tab);
    }
  }

  private close(target: TabTarget): void {
    this.layout.close(target.tab);
    this.focusAfterClose(target);
  }

  private closeAll(target: TabTarget): void {
    this.layout.closeTabs(target.group.tabs);
    this.focusAfterClose(target);
  }

  private focusAfterClose(target: TabTarget): void {
    const next = this.layout.layout().group(target.group.id)?.active ?? this.layout.currentGroup().active;
    if (!Object.isNull(next))
      this.tabFocus.focus(next);
  }

  private show(target: TabTarget, step: number): void {
    const count = target.group.tabs.length;
    const index = (target.index + step + count) % count;
    for (const tab of target.group.tabs.slice(index, index + 1)) {
      this.layout.activate(tab);
      this.tabFocus.focus(tab);
    }
  }

  private closeKeeping(tabs: readonly Tab[], kept: Tab): void {
    this.layout.closeTabs(tabs);
    this.tabFocus.focus(kept);
  }

  private place(tab: Tab, target: TabDropTarget | SplitDropTarget | SideDropTarget): void {
    this.layout.place(tab, target);
    this.tabFocus.focus(tab);
  }

  private async replaceMisspellingAsync(commandArguments: JsonValue): Promise<JsonValue> {
    const text = ShellCommandsService.textOf(commandArguments, Resources.textArgument);
    if (!Object.isNull(text) && await this.edits.restoreAsync())
      await this.bridge.replaceMisspellingAsync(text);
    return null;
  }

  private async addToDictionaryAsync(commandArguments: JsonValue): Promise<JsonValue> {
    const word = ShellCommandsService.textOf(commandArguments, Resources.wordArgument);
    if (!Object.isNull(word))
      await this.bridge.addToDictionaryAsync(word);
    await this.edits.restoreAsync();
    return null;
  }

  private async editAsync(action: EditAction): Promise<JsonValue> {
    const selection = action === EditAction.Copy ? this.edits.readSelection() : null;
    if (!Object.isNull(selection))
      await this.copySelectionAsync(selection);
    else if (this.edits.canRun(action) && await this.edits.restoreAsync())
      await this.bridge.editAsync(action);
    return null;
  }

  private async copySelectionAsync(selection: string): Promise<void> {
    await this.edits.restoreAsync();
    try {
      if (!await this.bridge.writeTextAsync(selection))
        this.bridge.logError(null, Resources.selectionCopyRefused);
    }
    catch (error) {
      this.bridge.logError(null, Resources.formatSelectionNotCopied(error instanceof Error ? error.message : String(error)));
    }
  }

  private done(action: () => void): Promise<JsonValue> {
    action();
    return Promise.resolve(null);
  }

  private opensInApp(commandArguments: JsonValue): boolean {
    return this.links.hasInAppBrowser && !Object.isNull(ShellCommandsService.webUrlOf(commandArguments));
  }

  private async openLinkAsync(commandArguments: JsonValue, place: LinkPlace): Promise<JsonValue> {
    const url = ShellCommandsService.webUrlOf(commandArguments);
    if (!Object.isNull(url))
      await this.links.openAsync(url, { place });
    return null;
  }

  private static webUrlOf(commandArguments: JsonValue): string | null {
    const url = ShellCommandsService.textOf(commandArguments, Resources.urlArgument);
    const link = Object.isNull(url) ? null : LinkPolicy.findAllowed(url);
    return !Object.isNull(link) && LinkService.isWeb(link) ? link : null;
  }

  private static textOf(commandArguments: JsonValue, name: string): string | null {
    const text = Object.isNull(commandArguments) ? undefined : JsonReader.fromValue(commandArguments).readOptionalString(name);
    return Object.isUndefined(text) || text.length === 0 ? null : text;
  }
}
