/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AriaLivePoliteness, FocusOrigin } from "@angular/cdk/a11y";
import type { ConnectedPosition } from "@angular/cdk/overlay";

import "@noldova/context.core";
import { DockingDirection, OverlaySide } from "@noldova/ui.components.angular";
import { EditAction, ModuleState, NotificationSeverity } from "@noldova/desktop.protocol";

import { BottomDockSpan } from "./app/enums/bottom-dock-span.js";
import { ClockChoice } from "./app/enums/clock-choice.js";
import { DockSide } from "./app/enums/dock-side.js";
import { PanelEdge } from "./app/enums/panel-edge.js";
import { SplitAxis } from "./app/enums/split-axis.js";
import { ToolbarMove } from "./app/enums/toolbar-move.js";

export class Resources {
  public static readonly contributionNamePattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.[A-Za-z0-9][A-Za-z0-9._-]*$/;
  public static readonly moduleIdPattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  public static readonly capitalLetterPattern: RegExp = /^\p{Lu}$/u;
  public static readonly idWordSeparator: string = ".";
  public static readonly windowPartContextToken: string = "The window part's context";
  public static readonly contentPaddingToken: string = "The padding of the page a tab shows";
  public static readonly shownToken: string = "Whether the page a tab shows is in view";
  public static readonly toolbarBandPageToken: string = "The toolbar band of the page a tab shows";
  public static readonly activeDocumentToken: string = "Whether the page a tab shows is the window's active document";
  public static readonly windowPartSourcesToken: string = "The build's window parts";
  public static readonly documentsGroupId: number = 0;
  public static readonly layoutFormatVersion: number = 1;
  public static readonly middlePreferredSize: number = 30;
  public static readonly dockReopenMargin: number = 2;
  public static readonly panelGapLook: string = "panel-card-gap";
  public static readonly panelMarginLook: string = "panel-card-margin";
  public static readonly dockMinimumLook: string = "dock-min-size";
  public static readonly dockStripLook: string = "dock-strip-size";
  public static readonly documentMinimumLook: string = "document-min-size";
  public static readonly groupMinimumLooks: Readonly<Record<SplitAxis, string>> = {
    [SplitAxis.Horizontal]: "group-min-width",
    [SplitAxis.Vertical]: "group-min-height"
  };
  public static readonly dockSizeLooks: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "dock-left-width",
    [DockSide.Right]: "dock-right-width",
    [DockSide.Bottom]: "dock-bottom-height"
  };
  public static readonly dockFullSizeLengths: Readonly<Record<DockSide, number | null>> = {
    [DockSide.Left]: null,
    [DockSide.Right]: null,
    [DockSide.Bottom]: 46.5
  };
  public static readonly lookProbeElement: string = "div";
  public static readonly dockEdges: Readonly<Record<DockSide, PanelEdge>> = {
    [DockSide.Left]: PanelEdge.Left,
    [DockSide.Right]: PanelEdge.Right,
    [DockSide.Bottom]: PanelEdge.Bottom
  };
  public static readonly edgeAxes: Readonly<Record<PanelEdge, SplitAxis>> = {
    [PanelEdge.Left]: SplitAxis.Horizontal,
    [PanelEdge.Right]: SplitAxis.Horizontal,
    [PanelEdge.Top]: SplitAxis.Vertical,
    [PanelEdge.Bottom]: SplitAxis.Vertical
  };
  public static readonly leadingEdges: readonly PanelEdge[] = [PanelEdge.Left, PanelEdge.Top];
  public static readonly layoutSaveDelay: number = 500;
  public static readonly pageHideEvent: string = "pagehide";
  public static readonly primaryButton: number = 0;
  public static readonly middleButton: number = 1;
  public static readonly escapeKey: string = "Escape";
  public static readonly keyDownEvent: "keydown" = "keydown";
  public static readonly webViewPressField: string = "press";
  public static readonly keepsCtrlKeysAttribute: string = "data-nol-keeps-ctrl-keys";
  public static readonly inertAttribute: string = "inert";
  public static readonly dialogContainerSelector: string = ".cdk-dialog-container";
  public static readonly reconnectingButtonSelector: string = ".nol-window-reconnecting button";
  public static readonly coverPositions: ConnectedPosition[] = [{ originX: "start", originY: "top", overlayX: "start", overlayY: "top" }];
  public static readonly clickEvent: "click" = "click";
  public static readonly auxClickEvent: "auxclick" = "auxclick";
  public static readonly contextMenuEvent: "contextmenu" = "contextmenu";
  public static readonly timeFormat: Readonly<Intl.DateTimeFormatOptions> = { hour: "numeric", minute: "2-digit" };
  public static readonly dayAndTimeFormat: Readonly<Intl.DateTimeFormatOptions> = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  public static readonly languageNamesFormat: Readonly<Intl.DisplayNamesOptions> = { type: "language", languageDisplay: "standard" };
  public static readonly maximumProgress: number = 100;
  public static readonly idListSeparator: string = " ";
  public static readonly commandAttribute: string = "data-command";
  public static readonly shortcutKeyClass: string = "nol-shortcut-key";
  public static readonly noSelectionDirection: "none" = "none";
  public static readonly dockingPlateGuides: number = 3;
  public static readonly titleParameterName: string = "title";
  public static readonly iconParameterName: string = "icon";
  public static readonly divElement: "div" = "div";
  public static readonly spanElement: "span" = "span";
  public static readonly menuPathStride: number = 3;
  public static readonly colorChannels: number = 3;
  public static readonly alphaIndex: number = 3;
  public static readonly channelMaximum: number = 255;
  public static readonly alphaDigits: number = 3;
  public static readonly colorListSeparator: string = ", ";
  public static readonly webProtocols: readonly string[] = ["http:", "https:"];
  public static readonly transitionEndEvent: "transitionend" = "transitionend";
  public static readonly fontsLoadedEvent: "loadingdone" = "loadingdone";
  public static readonly linkSelector: string = "a[href]";
  public static readonly draggingClass: string = "nol-tab-dragging";
  public static readonly dropGroupSelector: string = "[data-drop-group]";
  public static readonly dropGroupData: string = "dropGroup";
  public static readonly dropSideSelector: string = "[data-drop-side]";
  public static readonly dropSideData: string = "dropSide";
  public static readonly dropSpanData: string = "dropSpan";
  public static readonly dropTabsSelector: string = "[data-drop-tabs]";
  public static readonly dropPlateSelector: string = "[data-drop-plate]";
  public static readonly directionSelector: string = "[data-direction]";
  public static readonly scrollEvent: "scroll" = "scroll";
  public static readonly directionData: string = "direction";
  public static readonly tabIndexSelector: string = "[data-tab-index]";
  public static readonly tabIndexData: string = "tabIndex";
  public static readonly dropBeforeSelector: string = "[data-drop-before]";
  public static readonly dropBeforeData: string = "dropBefore";
  public static readonly dropAfterData: string = "dropAfter";
  public static readonly dropAxisData: string = "dropAxis";
  public static readonly dropTargetSeparator: string = ":";
  public static readonly tabKeySelector: string = "[data-tab-key]";
  public static readonly tabKeyData: string = "tabKey";
  public static readonly contentFocusTimeout: number = 10000;
  public static readonly tabGroupSelector: string = "nol-tab-group";
  public static readonly tabGroupData: string = "group";
  public static readonly tabCloseSelector: string = ".nol-tab-close";
  public static readonly selectedTabSelector: string = ".nol-tab-selected";
  public static readonly tabActionsWidthProperty: string = "--nol-tab-group-actions-width";
  public static readonly arrowLeftKey: string = "ArrowLeft";
  public static readonly arrowRightKey: string = "ArrowRight";
  public static readonly homeKey: string = "Home";
  public static readonly endKey: string = "End";
  public static readonly renameKey: string = "F2";
  public static readonly dockingGuideSize: number = 2.5;
  public static readonly sideDirections: Readonly<Record<DockSide, DockingDirection>> = {
    [DockSide.Left]: DockingDirection.Left,
    [DockSide.Right]: DockingDirection.Right,
    [DockSide.Bottom]: DockingDirection.Bottom
  };
  public static readonly edgeDirections: Readonly<Record<PanelEdge, DockingDirection>> = {
    [PanelEdge.Left]: DockingDirection.Left,
    [PanelEdge.Right]: DockingDirection.Right,
    [PanelEdge.Top]: DockingDirection.Top,
    [PanelEdge.Bottom]: DockingDirection.Bottom
  };
  public static readonly dockingPlateGap: number = 0.125;
  public static readonly dockingPlateClearance: number = 0.25;
  public static readonly viewGlyph: string = "web_asset";
  public static readonly documentGlyph: string = "description";
  public static readonly moduleFailureGlyph: string = "error";
  public static readonly moduleOffGlyph: string = "toggle_off";
  public static readonly moduleUnavailableGlyph: string = "block";
  public static readonly copyGlyph: string = "content_copy";
  public static readonly copiedGlyph: string = "check";
  public static readonly logFolderGlyph: string = "folder_open";
  public static readonly panelActionsGlyph: string = "more_horiz";
  public static readonly moveToGlyph: string = "drive_file_move";
  public static readonly splitGlyph: string = "splitscreen";
  public static readonly dockGlyph: string = "dock_to_right";
  public static readonly closeGlyph: string = "close";
  public static readonly closeOthersGlyph: string = "tab_close";
  public static readonly keepGlyph: string = "keep";
  public static readonly renameGlyph: string = "edit";
  public static readonly closeToTheRightGlyph: string = "tab_close_right";
  public static readonly closeAllGlyph: string = "clear_all";
  public static readonly moveEarlierGlyph: string = "arrow_back";
  public static readonly moveLaterGlyph: string = "arrow_forward";
  public static readonly resetLayoutGlyph: string = "restart_alt";
  public static readonly panelActionsLabel: string = "Panel actions";
  public static readonly overflowGlyph: string = "expand_more";
  public static readonly tabRowSubmenuGlyph: string = "expand_more";
  public static readonly tabRowCommandGlyph: string = "play_arrow";
  public static readonly overflowLabel: string = "Show all tabs";
  public static readonly moveToLabel: string = "Move to";
  public static readonly splitLabel: string = "Split";
  public static readonly dockLabel: string = "Dock";
  public static readonly closeTabLabel: string = "Close";
  public static readonly keepLabel: string = "Keep open";
  public static readonly renameLabel: string = "Rename";
  public static readonly closeOthersLabel: string = "Close others";
  public static readonly closeToTheRightLabel: string = "Close to the right";
  public static readonly closeAllLabel: string = "Close all";
  public static readonly moveEarlierLabel: string = "Move left";
  public static readonly moveLaterLabel: string = "Move right";
  public static readonly resetLayoutLabel: string = "Reset the layout";
  public static readonly bottomSpanCommands: Readonly<Record<BottomDockSpan, string>> = {
    [BottomDockSpan.Full]: "desktop.spanBottomDock",
    [BottomDockSpan.Between]: "desktop.fitBottomDockBetween"
  };
  public static readonly bottomSpanGlyphs: Readonly<Record<BottomDockSpan, string>> = {
    [BottomDockSpan.Full]: "width_full",
    [BottomDockSpan.Between]: "width_normal"
  };
  public static readonly bottomSpanLabels: Readonly<Record<BottomDockSpan, string>> = {
    [BottomDockSpan.Full]: "Bottom dock across the window",
    [BottomDockSpan.Between]: "Bottom dock between the side docks"
  };
  public static readonly documentsGroupLabel: string = "Documents";
  public static readonly moveToNextGroupLabel: string = "Move to next group";
  public static readonly moveToPreviousGroupLabel: string = "Move to previous group";
  public static readonly focusNextGroupLabel: string = "Focus next group";
  public static readonly focusPreviousGroupLabel: string = "Focus previous group";
  public static readonly groupLabelJoiner: string = ", ";
  public static readonly splitLabels: Readonly<Record<PanelEdge, string>> = {
    [PanelEdge.Left]: "Split left",
    [PanelEdge.Right]: "Split right",
    [PanelEdge.Top]: "Split up",
    [PanelEdge.Bottom]: "Split down"
  };
  public static readonly splitGlyphs: Readonly<Record<PanelEdge, string>> = {
    [PanelEdge.Left]: "arrow_back",
    [PanelEdge.Right]: "arrow_forward",
    [PanelEdge.Top]: "arrow_upward",
    [PanelEdge.Bottom]: "arrow_downward"
  };
  public static readonly dockRowLabels: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "Left dock",
    [DockSide.Right]: "Right dock",
    [DockSide.Bottom]: "Bottom dock"
  };
  public static readonly dockLabels: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "Dock left",
    [DockSide.Right]: "Dock right",
    [DockSide.Bottom]: "Dock at the bottom"
  };
  public static readonly dockGlyphs: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "dock_to_left",
    [DockSide.Right]: "dock_to_right",
    [DockSide.Bottom]: "dock_to_bottom"
  };
  public static readonly closeTabCommand: string = "desktop.closeTab";
  public static readonly keepTabCommand: string = "desktop.keepTab";
  public static readonly renameTabCommand: string = "desktop.renameTab";
  public static readonly closeOtherTabsCommand: string = "desktop.closeOtherTabs";
  public static readonly closeTabsToTheRightCommand: string = "desktop.closeTabsToTheRight";
  public static readonly closeAllTabsCommand: string = "desktop.closeAllTabs";
  public static readonly moveTabLeftCommand: string = "desktop.moveTabLeft";
  public static readonly moveTabRightCommand: string = "desktop.moveTabRight";
  public static readonly resetLayoutCommand: string = "desktop.resetLayout";
  public static readonly nextTabCommand: string = "desktop.nextTab";
  public static readonly previousTabCommand: string = "desktop.previousTab";
  public static readonly openSettingsCommand: string = "desktop.openSettings";
  public static readonly openSettingsTitle: string = "Settings…";
  public static readonly showShortcutsCommand: string = "desktop.showShortcuts";
  public static readonly showShortcutsTitle: string = "Show keyboard shortcuts";
  public static readonly showShortcutsGlyph: string = "keyboard";
  public static readonly showInDialogCommand: string = "desktop.showInDialog";
  public static readonly showInDialogTitle: string = "Show in a dialog";
  public static readonly showInDialogGlyph: string = "open_in_full";
  public static readonly openInMainWindowLabel: string = "Open in main window";
  public static readonly openInMainWindowGlyph: string = "tab_move";
  public static readonly dialogAlreadyOpen: string = "A dialog is already open.";
  public static readonly dialogWhileReconnecting: string = "A dialog can't open while the window reconnects to the runtime.";
  public static readonly settingsDocument: string = "desktop.settings";
  public static readonly settingsTitle: string = "Settings";
  public static readonly settingsReason: string = "Settings opens once the window has started";
  public static readonly settingsGlyph: string = "settings";
  public static readonly installCommandCommand: string = "desktop.installCommand";
  public static readonly installCommandTitle: string = "Install command in PATH";
  public static readonly installCommandGlyph: string = "terminal";
  public static readonly checkForUpdatesCommand: string = "desktop.checkForUpdates";
  public static readonly checkForUpdatesTitle: string = "Check for updates";
  public static readonly releasesLink: string = "Releases";
  public static readonly licensesTitle: string = "Licenses";
  public static readonly checkForUpdatesGlyph: string = "update";
  public static readonly restartToUpdateCommand: string = "desktop.restartToUpdate";
  public static readonly restartToUpdateTitle: string = "Restart to update";
  public static readonly restartToUpdateLabel: string = "Restart to update";
  public static readonly restartToUpdateGlyph: string = "restart_alt";
  public static readonly pageArgument: string = "page";
  public static readonly openLogFolderCommand: string = "desktop.openLogFolder";
  public static readonly copyDetailsCommand: string = "desktop.copyDetails";
  public static readonly openModulesCommand: string = "desktop.openModules";
  public static readonly openModulesTitle: string = "Modules…";
  public static readonly modulesDocument: string = "desktop.modules";
  public static readonly modulesTitle: string = "Modules";
  public static readonly modulesGlyph: string = "extension";
  public static readonly modifiedLabel: string = "Modified";
  public static readonly modifiedGlyph: string = "circle";
  public static readonly resetLabel: string = "Reset";
  public static readonly generalPage: string = "General";
  public static readonly dateTimeGroup: string = "Date and time";
  public static readonly runtimeGroup: string = "Runtime";
  public static readonly runtimeConnected: string = "Connected";
  public static readonly runtimeNotConnected: string = "Not connected";
  public static readonly clockSetting: string = "desktop.clock";
  public static readonly clockTitle: string = "Clock";
  public static readonly clockDescription: string = "Sets both formats below to the usual shape for that clock.";
  public static readonly clockTitles: Readonly<Record<ClockChoice, string>> = {
    [ClockChoice.TwelveHour]: "12-hour",
    [ClockChoice.TwentyFourHour]: "24-hour"
  };
  public static readonly timeFormatSetting: string = "desktop.timeFormat";
  public static readonly dateTimeFormatSetting: string = "desktop.dateTimeFormat";
  public static readonly clockFormats: Readonly<Record<ClockChoice, readonly [string, string]>> = {
    [ClockChoice.TwelveHour]: ["h:mm a", "MMM d, yyyy, h:mm a"],
    [ClockChoice.TwentyFourHour]: ["HH:mm", "d MMM yyyy, HH:mm"]
  };
  public static readonly appearancePage: string = "Appearance";
  public static readonly themeSetting: string = "desktop.theme";
  public static readonly modeSetting: string = "desktop.mode";
  public static readonly spellCheckSetting: string = "desktop.spellCheck";
  public static readonly spellCheckLanguagesSetting: string = "desktop.spellCheckLanguages";
  public static readonly trayIconSetting: string = "desktop.trayIcon";
  public static readonly languagesField: string = "languages";
  public static readonly fallbackField: string = "fallback";
  public static readonly xField: string = "x";
  public static readonly yField: string = "y";
  public static readonly isKeyboardField: string = "isKeyboard";
  public static readonly interfaceFontSetting: string = "desktop.interfaceFont";
  public static readonly codeFontSetting: string = "desktop.codeFont";
  public static readonly panelSizeSetting: string = "desktop.panelSize";
  public static readonly messageSizeSetting: string = "desktop.messageSize";
  public static readonly codeSizeSetting: string = "desktop.codeSize";
  public static readonly doNotDisturbSetting: string = "desktop.doNotDisturb";
  public static readonly mutedModulesSetting: string = "desktop.mutedModules";
  public static readonly keyBindingsSetting: string = "desktop.keyBindings";
  public static readonly notificationsPage: string = "Notifications";
  public static readonly shortcutsPage: string = "Keyboard shortcuts";
  public static readonly galleryPage: string = "Gallery";
  public static readonly aboutPage: string = "About";
  public static readonly galleryComponentToken: string = "GalleryComponent";
  public static readonly moduleSaverToken: string = "What saves a module's parts before it turns off";
  public static readonly leadingSettingsPages: readonly string[] = [Resources.generalPage, Resources.appearancePage, Resources.notificationsPage, Resources.shortcutsPage];
  public static readonly searchSettingsLabel: string = "Search settings";
  public static readonly settingsPagesLabel: string = "Settings pages";
  public static readonly noSettingsFound: string = "No settings match your search.";
  public static readonly settingsSearchResults: string = "Search results";
  public static readonly commandColumn: string = "Command";
  public static readonly ownerColumn: string = "From";
  public static readonly keyColumn: string = "Key";
  public static readonly actionsColumn: string = "Actions";
  public static readonly noKey: string = "No key";
  public static readonly choicePillMinimum: number = 2;
  public static readonly choicePillLimit: number = 4;
  public static readonly emptyOptionValue: string = "None";
  public static readonly noLanguagesNote: string = "No spelling languages are offered on this device.";
  public static readonly macSpellingNote: string = "On macOS the system chooses the spelling languages.";
  public static readonly noTrayHostNote: string =
    "This main process shows no tray icons right now, so the icon appears once it does. On GNOME, turning on the AppIndicator extension adds them.";
  public static readonly settingErrorIdPrefix: string = "nol-setting-error-";
  public static readonly settingDescriptionIdPrefix: string = "nol-setting-description-";
  public static readonly settingNoteIdPrefix: string = "nol-setting-note-";
  public static readonly shortcutCollisionIdPrefix: string = "nol-shortcut-collision-";
  public static readonly shortcutPaneNoteIdPrefix: string = "nol-shortcut-pane-note-";
  public static readonly shortcutNoticeIdPrefix: string = "nol-shortcut-notice-";
  public static readonly shortcutIdSeparator: string = "-";
  public static readonly shortcutsExplanation: string = "The keys that run commands. Choose a key to record a new one; your keys apply on every device.";
  public static readonly resetAllShortcutsLabel: string = "Reset all shortcuts";
  public static readonly removeKeyLabel: string = "Remove";
  public static readonly useKeyHereLabel: string = "Use it here";
  public static readonly cancelLabel: string = "Cancel";
  public static readonly recordingHint: string = "Press the new key";
  public static readonly recordingEllipsis: string = "…";
  public static readonly unknownKeyRefused: string = "This key can't be part of a shortcut.";
  public static readonly typingKeyRefused: string = "A key needs Ctrl, Alt or a function key.";
  public static readonly macTypingKeyRefused: string = "A key needs Command, Control, Option or a function key.";
  public static readonly windowsKeyRefused: string = "The Windows key can't be part of a shortcut.";
  public static readonly superKeyRefused: string = "The Super key can't be part of a shortcut.";
  public static readonly windowsPlatform: string = "win32";
  public static readonly modifierKeys: readonly string[] = ["Control", "Shift", "Alt", "AltGraph", "Meta", "OS"];
  public static readonly macModifierSymbols: readonly string[] = ["⌃", "⌥", "⇧", "⌘"];
  public static readonly modifierNames: readonly string[] = ["Ctrl", "Alt", "Shift"];
  public static readonly modifierSeparator: string = "+";
  public static readonly tabKey: string = "Tab";
  public static readonly showAllTabsCommand: string = "desktop.showAllTabs";
  public static readonly splitTabCommands: Readonly<Record<PanelEdge, string>> = {
    [PanelEdge.Left]: "desktop.splitTabLeft",
    [PanelEdge.Right]: "desktop.splitTabRight",
    [PanelEdge.Top]: "desktop.splitTabUp",
    [PanelEdge.Bottom]: "desktop.splitTabDown"
  };
  public static readonly dockTabCommands: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "desktop.dockTabLeft",
    [DockSide.Right]: "desktop.dockTabRight",
    [DockSide.Bottom]: "desktop.dockTabBottom"
  };
  public static readonly toggleDockCommands: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "desktop.toggleLeftDock",
    [DockSide.Right]: "desktop.toggleRightDock",
    [DockSide.Bottom]: "desktop.toggleBottomDock"
  };
  public static readonly closeTabTitle: string = "Close the tab";
  public static readonly keepTabTitle: string = "Keep the tab open";
  public static readonly renameTabTitle: string = "Rename the tab";
  public static readonly closeOtherTabsTitle: string = "Close the other tabs";
  public static readonly closeTabsToTheRightTitle: string = "Close the tabs to the right";
  public static readonly closeAllTabsTitle: string = "Close all tabs in the group";
  public static readonly moveTabLeftTitle: string = "Move the tab left";
  public static readonly moveTabRightTitle: string = "Move the tab right";
  public static readonly nextTabTitle: string = "Show the next tab";
  public static readonly previousTabTitle: string = "Show the previous tab";
  public static readonly nextTabGlyph: string = "keyboard_tab";
  public static readonly previousTabGlyph: string = "keyboard_tab_rtl";
  public static readonly splitTabTitles: Readonly<Record<PanelEdge, string>> = {
    [PanelEdge.Left]: "Split the tab left",
    [PanelEdge.Right]: "Split the tab right",
    [PanelEdge.Top]: "Split the tab up",
    [PanelEdge.Bottom]: "Split the tab down"
  };
  public static readonly dockTabTitles: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "Dock the tab left",
    [DockSide.Right]: "Dock the tab right",
    [DockSide.Bottom]: "Dock the tab at the bottom"
  };
  public static readonly toggleDockTitles: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "Show or hide the left dock",
    [DockSide.Right]: "Show or hide the right dock",
    [DockSide.Bottom]: "Show or hide the bottom dock"
  };
  public static readonly tabArgument: string = "tab";
  public static readonly tabGroupArgument: string = "tabGroup";
  public static readonly documentArgument: string = "document";
  public static readonly instanceArgument: string = "instance";
  public static readonly searchCommand: string = "desktop.search";
  public static readonly searchTitle: string = "Search";
  public static readonly sourceArgument: string = "source";
  public static readonly showCommandsCommand: string = "desktop.showCommands";
  public static readonly showCommandsTitle: string = "Show all commands";
  public static readonly showCommandsGlyph: string = "search";
  public static readonly goBackCommand: string = "desktop.goBack";
  public static readonly goBackTitle: string = "Back";
  public static readonly goBackGlyph: string = "arrow_back";
  public static readonly goForwardCommand: string = "desktop.goForward";
  public static readonly goForwardTitle: string = "Forward";
  public static readonly goForwardGlyph: string = "arrow_forward";
  public static readonly goBackReason: string = "No earlier document to go back to";
  public static readonly goForwardReason: string = "No later document to go forward to";
  public static readonly documentHistoryLimit: number = 50;
  public static readonly toggleViewCommand: string = "desktop.toggleView";
  public static readonly toggleViewTitle: string = "Show or hide a view";
  public static readonly toggleViewGlyph: string = "view_sidebar";
  public static readonly viewArgument: string = "view";
  public static readonly commandsOnlyPrefix: string = ">";
  public static readonly wordCharacterPattern: RegExp = /[\p{L}\p{N}]/u;
  public static readonly allFilterLabel: string = "All";
  public static readonly searchGroupRows: number = 2;
  public static readonly recentAsk: string = "recent";
  public static readonly answerAsk: string = "answer";
  public static readonly bestMatchGroup: string = "desktop.bestMatch";
  public static readonly bestMatchHeading: string = "Best match";
  public static readonly commandsSearchSource: string = "desktop.commands";
  public static readonly commandsSearchLabel: string = "Commands";
  public static readonly commandsPlaceholderName: string = "commands";
  public static readonly recentCommandsHeading: string = "Recent commands";
  public static readonly commandsSearchGlyph: string = "terminal";
  public static readonly settingsSearchSource: string = "desktop.settings";
  public static readonly settingsSearchLabel: string = "Settings";
  public static readonly settingsPlaceholderName: string = "settings";
  public static readonly settingsSearchGlyph: string = "settings";
  public static readonly settingControlSelector: string = "input, select, textarea, button, [tabindex]:not([tabindex=\"-1\"])";
  public static readonly recentCommandCountSetting: string = "desktop.recentCommandCount";
  public static readonly searchPaneClass: string = "nol-search-pane";
  public static readonly searchMarginProbeStyle: string = "position: fixed; visibility: hidden; height: var(--nol-quick-input-margin)";
  public static readonly searchGlyph: string = "search";
  public static readonly cappedCountMark: string = "+";
  public static readonly nothingFound: string = "Nothing found.";
  public static readonly searchFooterHints: readonly string[] = ["Enter to open", "↑ ↓ to move", "Tab for the next filter"];
  public static readonly commandsOnlyHint: string = "Type > for commands only";
  public static readonly windowPalettePaneClass: string = "nol-window-palette-pane";
  public static readonly windowRowSelector: string = "nol-window-row";
  public static readonly detailSeparator: string = " ";
  public static readonly keyboardFocusOrigin: FocusOrigin = "keyboard";
  public static readonly mouseFocusOrigin: FocusOrigin = "mouse";
  public static readonly hideDockLabels: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "Hide the left dock",
    [DockSide.Right]: "Hide the right dock",
    [DockSide.Bottom]: "Hide the bottom dock"
  };
  public static readonly dockStripSelector: string = ".nol-dock-strip";
  public static readonly horizontalOrientation: string = "horizontal";
  public static readonly regionRole: string = "region";
  public static readonly tabPanelRole: string = "tabpanel";
  public static readonly verticalOrientation: string = "vertical";
  public static readonly rightToLeft: string = "rtl";
  public static readonly previewTabsSetting: string = "desktop.previewTabs";
  public static readonly dockStyleSettings: ReadonlyMap<DockSide, string> = new Map([[DockSide.Left, "desktop.leftDockStyle"], [DockSide.Right, "desktop.rightDockStyle"]]);
  public static readonly dockStripLabels: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "Left dock views",
    [DockSide.Right]: "Right dock views",
    [DockSide.Bottom]: "Bottom dock views"
  };
  public static readonly dockStripTooltipSides: Readonly<Record<DockSide, OverlaySide>> = {
    [DockSide.Left]: OverlaySide.end,
    [DockSide.Right]: OverlaySide.start,
    [DockSide.Bottom]: OverlaySide.above
  };
  public static readonly hideDockGlyphs: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "left_panel_close",
    [DockSide.Right]: "right_panel_close",
    [DockSide.Bottom]: "bottom_panel_close"
  };
  public static readonly showLeftDockGlyph: string = "left_panel_open";
  public static readonly showLeftDockLabel: string = "Show the left dock";
  public static readonly hideLeftDockLabel: string = "Hide the left dock";
  public static readonly resizeDockLabels: Readonly<Record<DockSide, string>> = {
    [DockSide.Left]: "Resize the left dock",
    [DockSide.Right]: "Resize the right dock",
    [DockSide.Bottom]: "Resize the bottom dock"
  };
  public static readonly tabIdPrefix: string = "nol-tab-";
  public static readonly tabIdSeparator: string = "-";
  public static readonly tabPanelIdPrefix: string = "nol-tab-panel-";
  public static readonly resizeSplitLabels: Readonly<Record<SplitAxis, string>> = {
    [SplitAxis.Horizontal]: "Resize the pane on the left",
    [SplitAxis.Vertical]: "Resize the pane above"
  };
  public static readonly versionField: string = "version";
  public static readonly docksField: string = "docks";
  public static readonly middleField: string = "middle";
  public static readonly middleSizeField: string = "middleSize";
  public static readonly titlesField: string = "titles";
  public static readonly rootField: string = "root";
  public static readonly sizeField: string = "size";
  public static readonly collapsedField: string = "collapsed";
  public static readonly bottomSpanField: string = "bottomSpan";
  public static readonly toolbarsField: string = "toolbars";
  public static readonly viewToolbarsField: string = "viewToolbars";
  public static readonly hiddenField: string = "hidden";
  public static readonly rowsParameter: string = "rows";
  public static readonly invalidToolbarLayout: string = "A toolbar arrangement names each toolbar once and has no empty row.";
  public static readonly axisField: string = "axis";
  public static readonly childrenField: string = "children";
  public static readonly weightField: string = "weight";
  public static readonly tabsField: string = "tabs";
  public static readonly activeField: string = "active";
  public static readonly previewField: string = "preview";
  public static readonly recentField: string = "recent";
  public static readonly documentsField: string = "documents";
  public static readonly activeDocumentsField: string = "activeDocuments";
  public static readonly viewField: string = "view";
  public static readonly documentField: string = "document";
  public static readonly instanceField: string = "instance";
  public static readonly keySeparator: string = "/";
  public static readonly shellOwner: string = "desktop";
  public static readonly contributionSeparator: string = ".";
  public static readonly nameParameter: string = "name";
  public static readonly instanceParameter: string = "instance";
  public static readonly lifetimeParameter: string = "lifetime";
  public static readonly minimumParameter: string = "minimum";
  public static readonly dockGrowthMinimumInvalid: string = "A dock growth's minimum is a finite number of rem above 0.";
  public static readonly filesParameter: string = "files";
  public static readonly maximumOfferedFiles: number = 256;
  public static readonly fileGrantLifetimeInvalid: string = "A file grant's lifetime is a whole number of milliseconds from 1 to 600 000.";
  public static readonly tooManyOfferedFiles: string = "A window part offers at most 256 files at once.";
  public static readonly extensionsParameter: string = "extensions";
  public static readonly folderParameter: string = "folder";
  public static readonly maximumFileExtensions: number = 32;
  public static readonly fileExtensionPattern: RegExp = /^[A-Za-z0-9]{1,16}$/;
  public static readonly fileExtensionsInvalid: string = "A file choice's extensions are 1 to 32 extensions of 1 to 16 letters and digits each, without a dot.";
  public static readonly fileChoiceFolderInvalid: string = "A file choice's starting folder is an absolute path on the window's platform, without control characters.";
  public static readonly posixAbsolutePathPattern: RegExp = /^\//;
  public static readonly windowsAbsolutePathPattern: RegExp = /^(?:[A-Za-z]:)?[\\/]/;
  public static readonly controlCharacterPattern: RegExp = /\p{Cc}/u;
  public static readonly grantParameter: string = "grant";
  public static readonly sharedFileScheme: string = "desktop-file";
  public static readonly sharedFileGrantPattern: RegExp = /^[0-9a-f]{32}$/;
  public static readonly sharedFileGrantInvalid: string = "A shared file's grant is 32 lowercase hexadecimal digits.";
  public static readonly titleParameter: string = "title";
  public static readonly idParameter: string = "id";
  public static readonly settingAttribute: string = "data-setting";
  public static readonly foundRowClass: string = "nol-setting-row-found";
  public static readonly foundRowBlock: ScrollLogicalPosition = "center";
  public static readonly iconParameter: string = "icon";
  public static readonly countParameter: string = "count";
  public static readonly descriptionParameter: string = "description";
  public static readonly badgeCountInvalid: string = "A badge's count must be a whole number from 1, or null for a dot.";
  public static readonly breadcrumbParameter: string = "breadcrumb";
  public static readonly breadcrumbIconParameter: string = "breadcrumbIcon";
  public static readonly invalidBreadcrumb: string = "A breadcrumb is a list of segments that are not blank.";
  public static readonly invalidDocumentImage: string = "A document's image is a data:image URL, since the window loads no other images.";
  public static readonly documentImagePattern: RegExp = /^data:image\/[a-z0-9.+-]+(;[^,]*)?,/i;
  public static readonly imageParameter: string = "image";
  public static readonly imageGlyphParameter: string = "imageGlyph";
  public static readonly statusParameter: string = "status";
  public static readonly markerParameter: string = "marker";
  public static readonly breadcrumbIconWithoutBreadcrumb: string = "A breadcrumb's glyph comes with the breadcrumb it goes before.";
  public static readonly breadcrumbSeparator: string = " / ";
  public static readonly textParameter: string = "text";
  public static readonly tooltipParameter: string = "tooltip";
  public static readonly commandParameter: string = "command";
  public static readonly viewKind: string = "view";
  public static readonly documentKind: string = "document";
  public static readonly placeholderKind: string = "placeholder";
  public static readonly settingsPageKind: string = "settings page";
  public static readonly settingsPageLoading: string = "Loading the page";
  public static readonly settingsPageLoadFailed: string = "Its settings page could not be loaded.";
  public static readonly pageLoadFailed: string = "Its page could not be loaded.";
  public static readonly openSettingsPageLabel: string = "Open page";
  public static readonly viewOrDocumentKind: string = "view or document";
  public static readonly instanceViewKind: string = "view with instances";
  public static readonly plainViewKind: string = "view without instances";
  public static readonly renamableKind: string = "renamable view or document";
  public static readonly statusBarItemKind: string = "status bar item";
  public static readonly dynamicMenuGroupKind: string = "dynamic menu group";
  public static readonly dynamicSettingKind: string = "dynamic choice setting";
  public static readonly checkedSettingKind: string = "checked text setting";
  public static readonly topBarActionKind: string = "top bar action";
  public static readonly notificationKind: string = "notification kind";
  public static readonly statusBarItemEmpty: string = "A status bar item shows text, an icon or both.";
  public static readonly statusBarItemUnnamed: string = "A status bar item that shows only an icon needs a tooltip, which is also its accessible name.";
  public static readonly defaultKeyParameter: string = "defaultKey";
  public static readonly submenuParameter: string = "submenu";
  public static readonly placeParameter: string = "place";
  public static readonly itemsParameter: string = "items";
  public static readonly emptyMenuGroup: string = "A menu group has at least one item.";
  public static readonly itemsInDynamicGroup: string = "A dynamic menu group has no declared items; its owner supplies them.";
  public static readonly labelParameter: string = "label";
  public static readonly startParameter: string = "start";
  public static readonly lengthParameter: string = "length";
  public static readonly titleMatchParameter: string = "titleMatch";
  public static readonly detailMatchParameter: string = "detailMatch";
  public static readonly keyLabelParameter: string = "keyLabel";
  public static readonly totalParameter: string = "total";
  public static readonly placeholderNameParameter: string = "placeholderName";
  public static readonly headingParameter: string = "heading";
  public static readonly recentHeadingParameter: string = "recentHeading";
  public static readonly textRangeStartInvalid: string = "A text range starts at a whole number of characters, 0 or more.";
  public static readonly textRangeLengthInvalid: string = "A text range is a whole number of characters long, 1 or more.";
  public static readonly textRangeOutside: string = "A matched range lies within its text.";
  public static readonly searchTotalInvalid: string = "A search answer's total is a whole number, at least as many as the results it lists.";
  public static readonly placesField: string = "places";
  public static readonly groupsField: string = "groups";
  public static readonly nameField: string = "name";
  public static readonly grantField: string = "grant";
  public static readonly mediaTypeField: string = "mediaType";
  public static readonly grantedField: string = "granted";
  public static readonly refusedField: string = "refused";
  public static readonly lifetimeField: string = "lifetime";
  public static readonly multipleField: string = "multiple";
  public static readonly extensionsField: string = "extensions";
  public static readonly folderField: string = "folder";
  public static readonly titleField: string = "title";
  public static readonly showsField: string = "shows";
  public static readonly shownField: string = "shown";
  public static readonly afterField: string = "after";
  public static readonly beforeField: string = "before";
  public static readonly newRowField: string = "newRow";
  public static readonly bandField: string = "band";
  public static readonly dynamicField: string = "dynamic";
  public static readonly choiceField: string = "choice";
  public static readonly showsMenuBar: string = "menuBar";
  public static readonly showsToolbar: string = "toolbar";
  public static readonly afterParameter: string = "after";
  public static readonly choiceParameter: string = "choice";
  public static readonly severalToolbarPositions: string = "A toolbar has at most one of a place after another, a place before another and a row of its own.";
  public static readonly placeField: string = "place";
  public static readonly exclusiveField: string = "exclusive";
  public static readonly itemsField: string = "items";
  public static readonly submenuField: string = "submenu";
  public static readonly commandField: string = "command";
  public static readonly argumentsField: string = "arguments";
  public static readonly menusField: string = "menus";
  public static readonly rowsField: string = "rows";
  public static readonly typeField: string = "type";
  public static readonly idField: string = "id";
  public static readonly labelField: string = "label";
  public static readonly keyField: string = "key";
  public static readonly enabledField: string = "enabled";
  public static readonly checkField: string = "check";
  public static readonly checkedField: string = "checked";
  public static readonly commandRowType: string = "Command";
  public static readonly submenuRowType: string = "Submenu";
  public static readonly separatorRowType: string = "Separator";
  public static readonly menuRowPathSeparator: string = "/";
  public static readonly menuTitleSeparator: string = " › ";
  public static readonly menuGlyph: string = "menu";
  public static readonly focusInEvent: string = "focusin";
  public static readonly focusOutEvent: string = "focusout";
  public static readonly pointerDownEvent: string = "pointerdown";
  public static readonly transientFocusSelector: string = ".cdk-overlay-container, [data-nol-chrome]";
  public static readonly textInputTypes: readonly string[] = ["text", "search", "url", "tel", "password", "email", "number"];
  public static readonly editingGroup: string = "desktop.editing";
  public static readonly editCommands: Readonly<Record<EditAction, string>> = {
    [EditAction.Undo]: "desktop.undo",
    [EditAction.Redo]: "desktop.redo",
    [EditAction.Cut]: "desktop.cut",
    [EditAction.Copy]: "desktop.copy",
    [EditAction.Paste]: "desktop.paste",
    [EditAction.SelectAll]: "desktop.selectAll"
  };
  public static readonly modalCommands: readonly string[] = Object.values(Resources.editCommands);
  public static readonly editTitles: Readonly<Record<EditAction, string>> = {
    [EditAction.Undo]: "Undo",
    [EditAction.Redo]: "Redo",
    [EditAction.Cut]: "Cut",
    [EditAction.Copy]: "Copy",
    [EditAction.Paste]: "Paste",
    [EditAction.SelectAll]: "Select all"
  };
  public static readonly editGlyphs: Readonly<Record<EditAction, string>> = {
    [EditAction.Undo]: "undo",
    [EditAction.Redo]: "redo",
    [EditAction.Cut]: "content_cut",
    [EditAction.Copy]: "content_copy",
    [EditAction.Paste]: "content_paste",
    [EditAction.SelectAll]: "select_all"
  };
  public static readonly menuLabel: string = "Menu";
  public static readonly menuBarLabel: string = "Menus";
  public static readonly menuBarSetting: string = "desktop.menuBar";
  public static readonly menuBarItemSelector: string = "[nol-menu-bar-item]";
  public static readonly windowRowMinimumDragRem: number = 6;
  public static readonly searchFieldMinimumRem: number = 12;
  public static readonly searchFieldWidthProperty: string = "--nol-window-row-search-width";
  public static readonly titleBarNameMinimumRem: number = 3;
  public static readonly windowControlsLabel: string = "Window controls";
  public static readonly minimizeWindowLabel: string = "Minimize";
  public static readonly maximizeWindowLabel: string = "Maximize";
  public static readonly restoreWindowLabel: string = "Restore";
  public static readonly closeWindowLabel: string = "Close";
  public static readonly altKey: string = "Alt";
  public static readonly functionKey: string = "F10";
  public static readonly contextMenuKey: string = "ContextMenu";
  public static readonly ariaExpandedAttribute: string = "aria-expanded";
  public static readonly trueValue: string = "true";
  public static readonly fileMenu: string = "desktop.file";
  public static readonly editMenu: string = "desktop.edit";
  public static readonly viewMenu: string = "desktop.view";
  public static readonly windowMenu: string = "desktop.window";
  public static readonly helpMenu: string = "desktop.help";
  public static readonly tabMenu: string = "desktop.tab";
  public static readonly fileMenuTitle: string = "File";
  public static readonly editMenuTitle: string = "Edit";
  public static readonly viewMenuTitle: string = "View";
  public static readonly windowMenuTitle: string = "Window";
  public static readonly helpMenuTitle: string = "Help";
  public static readonly tabMenuTitle: string = "Tab";
  public static readonly fieldMenu: string = "desktop.field";
  public static readonly fieldMenuTitle: string = "Text field";
  public static readonly fieldEditingGroup: string = "desktop.fieldEditing";
  public static readonly fieldEditActions: readonly EditAction[] = [EditAction.Cut, EditAction.Copy, EditAction.Paste, EditAction.SelectAll];
  public static readonly fieldSpellingGroup: string = "desktop.fieldSpelling";
  public static readonly replaceMisspellingCommand: string = "desktop.replaceMisspelling";
  public static readonly replaceMisspellingTitle: string = "Replace the misspelled word";
  public static readonly addToDictionaryCommand: string = "desktop.addToDictionary";
  public static readonly addToDictionaryTitle: string = "Add to dictionary";
  public static readonly addToDictionaryGlyph: string = "library_add";
  public static readonly linkMenu: string = "desktop.link";
  public static readonly linkMenuTitle: string = "Link";
  public static readonly linkOpenGroup: string = "desktop.linkOpen";
  public static readonly openLinkInAppCommand: string = "desktop.openLinkInApp";
  public static readonly openLinkInAppGlyph: string = "tab";
  public static readonly openLinkInBrowserCommand: string = "desktop.openLinkInBrowser";
  public static readonly openLinkInBrowserTitle: string = "Open in your browser";
  public static readonly openLinkInBrowserGlyph: string = "open_in_new";
  public static readonly urlArgument: string = "url";
  public static readonly inAppBrowserTaken: string = "Another window part is already the in-app browser.";
  public static readonly noSuggestionsLabel: string = "No suggestions";
  public static readonly textArgument: string = "text";
  public static readonly wordArgument: string = "word";
  public static readonly suggestionsArgument: string = "suggestions";
  public static readonly suggestionLimit: number = 5;
  public static readonly fieldMenuSlack: number = 1;
  public static readonly closeGroup: string = "desktop.close";
  public static readonly tabMoveToMenu: string = "desktop.tabMoveTo";
  public static readonly tabSplitMenu: string = "desktop.tabSplit";
  public static readonly tabDockMenu: string = "desktop.tabDock";
  public static readonly tabArrangeGroup: string = "desktop.tabArrange";
  public static readonly tabCloseGroup: string = "desktop.tabClose";
  public static readonly tabDestinationsGroup: string = "desktop.tabDestinations";
  public static readonly tabSplitGroup: string = "desktop.tabSplitEdges";
  public static readonly tabDockGroup: string = "desktop.tabDockSides";
  public static readonly moveTabToGroupCommand: string = "desktop.moveTabToGroup";
  public static readonly moveTabToNextGroupCommand: string = "desktop.moveTabToNextGroup";
  public static readonly moveTabToPreviousGroupCommand: string = "desktop.moveTabToPreviousGroup";
  public static readonly moveTabToNextGroupTitle: string = "Move the tab to the next group";
  public static readonly moveTabToPreviousGroupTitle: string = "Move the tab to the previous group";
  public static readonly focusNextGroupCommand: string = "desktop.focusNextGroup";
  public static readonly focusPreviousGroupCommand: string = "desktop.focusPreviousGroup";
  public static readonly focusNextGroupTitle: string = "Focus the next group";
  public static readonly focusPreviousGroupTitle: string = "Focus the previous group";
  public static readonly focusNextGroupGlyph: string = "keyboard_double_arrow_right";
  public static readonly focusPreviousGroupGlyph: string = "keyboard_double_arrow_left";
  public static readonly focusNextRegionCommand: string = "desktop.focusNextRegion";
  public static readonly focusPreviousRegionCommand: string = "desktop.focusPreviousRegion";
  public static readonly focusNextRegionTitle: string = "Focus the next region";
  public static readonly focusPreviousRegionTitle: string = "Focus the previous region";
  public static readonly focusNextRegionGlyph: string = "move_down";
  public static readonly focusPreviousRegionGlyph: string = "move_up";
  public static readonly regionSelector: string = "nol-window-row, nol-toolbar-band:not(nol-view-toolbar-band nol-toolbar-band), nol-dock, nol-tab-group, nol-status-bar";
  public static readonly regionContentSelector: string = "nol-tab-slot";
  public static readonly webViewGuestSelector: string = ".nol-web-view-guest";
  public static readonly webViewFrameSelector: string = ".nol-web-view";
  public static readonly regionVisibility: CheckVisibilityOptions = { visibilityProperty: true, opacityProperty: true };
  public static readonly tabbableSelector: string = "a[href], button, input, select, textarea, [tabindex], [contenteditable]";
  public static readonly groupsGroup: string = "desktop.groups";
  public static readonly moveTabToGroupTitle: string = "Move the tab to another group";
  public static readonly groupArgument: string = "group";
  public static readonly searchGroup: string = "desktop.search";
  public static readonly docksGroup: string = "desktop.docks";
  public static readonly bottomDockGroup: string = "desktop.bottomDock";
  public static readonly layoutGroup: string = "desktop.layout";
  public static readonly layoutMenu: string = "desktop.layoutMenu";
  public static readonly layoutMenuTitle: string = "Layout";
  public static readonly layoutMenuGlyph: string = "dashboard";
  public static readonly layoutDocksGroup: string = "desktop.layoutDocks";
  public static readonly layoutViewsGroup: string = "desktop.layoutViews";
  public static readonly layoutResetGroup: string = "desktop.layoutReset";
  public static readonly modulesGroup: string = "desktop.modules";
  public static readonly toolbarsMenu: string = "desktop.toolbars";
  public static readonly toolbarsMenuTitle: string = "Toolbars";
  public static readonly noPlace: string = String.empty;
  public static readonly toolbarListGroup: string = "desktop.toolbarList";
  public static readonly tabToolbarsGroup: string = "desktop.tabToolbars";
  public static readonly toolbarBandIdArgument: string = "toolbarBand";
  public static readonly viewToolbarsGroup: string = "desktop.viewToolbars";
  public static readonly toggleToolbarCommand: string = "desktop.toggleToolbar";
  public static readonly toggleToolbarTitle: string = "Show or hide a toolbar";
  public static readonly toolbarArgument: string = "toolbar";
  public static readonly bandArgument: string = "band";
  public static readonly focusToolbarsCommand: string = "desktop.focusToolbars";
  public static readonly focusToolbarsTitle: string = "Focus the toolbars";
  public static readonly focusToolbarsGlyph: string = "toolbar";
  public static readonly toolbarItemSelector: string = ".nol-toolbar-item[tabindex=\"0\"]";
  public static readonly toolbarSectionSelector: string = ".nol-toolbar-ghost-section";
  public static readonly toolbarOverflowSelector: string = ".nol-toolbar-ghost-overflow";
  public static readonly toolbarFitTolerance: number = 0.5;
  public static readonly toolbarEdgeFraction: number = 4;
  public static readonly toolbarBandSelector: string = ".nol-toolbar-band";
  public static readonly toolbarRowSelector: string = ".nol-toolbar-row";
  public static readonly toolbarSelector: string = ".nol-toolbar[data-toolbar]";
  public static readonly toolbarData: string = "toolbar";
  public static readonly toolbarRowData: string = "toolbarRow";
  public static readonly toolbarIndexData: string = "toolbarIndex";
  public static readonly toolbarOverflowLabel: string = "More actions";
  public static readonly toolbarOverflowGlyph: string = "more_horiz";
  public static readonly toolbarGripLabel: string = "Move toolbar";
  public static readonly toolbarMenu: string = "desktop.toolbar";
  public static readonly toolbarMenuTitle: string = "Toolbar";
  public static readonly toolbarMoveGroup: string = "desktop.toolbarMove";
  public static readonly toolbarHideGroup: string = "desktop.toolbarHide";
  public static readonly moveToolbarCommands: Readonly<Record<ToolbarMove, string>> = {
    [ToolbarMove.Left]: "desktop.moveToolbarLeft",
    [ToolbarMove.Right]: "desktop.moveToolbarRight",
    [ToolbarMove.Up]: "desktop.moveToolbarUp",
    [ToolbarMove.Down]: "desktop.moveToolbarDown"
  };
  public static readonly moveToolbarTitles: Readonly<Record<ToolbarMove, string>> = {
    [ToolbarMove.Left]: "Move the toolbar left",
    [ToolbarMove.Right]: "Move the toolbar right",
    [ToolbarMove.Up]: "Move the toolbar to the row above",
    [ToolbarMove.Down]: "Move the toolbar to the row below"
  };
  public static readonly moveToolbarLabels: Readonly<Record<ToolbarMove, string>> = {
    [ToolbarMove.Left]: "Move left",
    [ToolbarMove.Right]: "Move right",
    [ToolbarMove.Up]: "Move to the row above",
    [ToolbarMove.Down]: "Move to the row below"
  };
  public static readonly moveToolbarGlyphs: Readonly<Record<ToolbarMove, string>> = {
    [ToolbarMove.Left]: "arrow_back",
    [ToolbarMove.Right]: "arrow_forward",
    [ToolbarMove.Up]: "arrow_upward",
    [ToolbarMove.Down]: "arrow_downward"
  };
  public static readonly hideToolbarGlyph: string = "visibility_off";
  public static readonly hideToolbarCommand: string = "desktop.hideToolbar";
  public static readonly hideToolbarTitle: string = "Hide the toolbar";
  public static readonly hideToolbarLabel: string = "Hide toolbar";
  public static readonly toolbarGripSelector: string = ".nol-toolbar-grip";
  public static readonly searchFieldSelector: string = ".nol-window-row-search";
  public static readonly toolbarsSubmenuGroup: string = "desktop.toolbarsSubmenu";
  public static readonly toolbarContentSectionSelector: string = ".nol-toolbar-section";
  public static readonly toolbarOverflowItemSelector: string = ".nol-toolbar-overflow";
  public static readonly toolbarGroupData: string = "group";
  public static readonly focusedSelector: string = ":focus";
  public static readonly toolbarMenuKey: string = "ContextMenu";
  public static readonly toolbarMenuShiftKey: string = "F10";
  public static readonly settingsGroup: string = "desktop.settings";
  public static readonly commandLineGroup: string = "desktop.commandLine";
  public static readonly updatesGroup: string = "desktop.updates";
  public static readonly supportGroup: string = "desktop.support";
  public static readonly windowPartMenusToken: string = "The build's module menus";
  public static readonly productAboutToken: string = "The app's About details";
  public static readonly productTitleBarToken: string = "The app's name and icon in the title bar";
  public static readonly tabInput: string = "tab";
  public static readonly dockedInput: string = "isDocked";
  public static readonly shownInput: string = "isShown";
  public static readonly concealedTabContentClass: string = "nol-tab-content-concealed";
  public static readonly paintedTabContentClass: string = "nol-tab-content-painted";
  public static readonly coveringTabContentClass: string = "nol-tab-content-covering";
  public static readonly invalidContributionName: string = "A contribution name has the form <module id>.<name>.";
  public static readonly renamableViewWithoutInstances: string = "Only a view with instances can be renamable.";
  public static readonly invalidDefaultPlace: string = "A view's default group and default order are whole numbers of 0 or more.";
  public static readonly invalidPreferredWidth: string = "A preferred width is a finite number of rem greater than 0.";
  public static readonly invalidModuleId: string = "A module id is lowercase kebab-case.";
  public static readonly windowPartLoadFailed: string = "Its window part could not be loaded.";
  public static readonly windowPartActivationFailed: string = "Its window part failed to activate.";
  public static readonly fileNotShownWithoutReason: string = "the main process gave no reason.";
  public static readonly windowPartReconnectionFailed: string = "Its window part failed to continue after the runtime started again.";
  public static readonly windowPartDependencyListenerFailed: string = "Its window part failed to follow a change of a module it optionally depends on.";
  public static readonly partSaveTimeout: number = 4000;
  public static readonly windowLogLimit: number = 65536;
  public static readonly imageCopyByteLimit: number = 64 * 1024 * 1024;
  public static readonly imageCopyPixelLimit: number = 50_000_000;
  public static readonly imageCopySideLimit: number = 16384;
  public static readonly pngSignature: readonly number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  public static readonly pngHeaderChunk: readonly number[] = [0x49, 0x48, 0x44, 0x52];
  public static readonly jpegSignature: readonly number[] = [0xff, 0xd8, 0xff];
  public static readonly jpegFrameMarkers: readonly number[] = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];
  public static readonly jpegEndMarkers: readonly number[] = [0xd9, 0xda];
  public static readonly jpegStandaloneMarkers: readonly number[] = [0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7];
  public static readonly gifColorTableFlag: number = 0x80;
  public static readonly gifExtensionIntroducer: number = 0x21;
  public static readonly gifImageSeparator: number = 0x2c;
  public static readonly gifSignatures: readonly (readonly number[])[] = [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]];
  public static readonly webpSignature: readonly (number | null)[] = [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50];
  public static readonly webpLossyChunk: readonly number[] = [0x56, 0x50, 0x38, 0x20];
  public static readonly webpLosslessChunk: readonly number[] = [0x56, 0x50, 0x38, 0x4c];
  public static readonly webpExtendedChunk: readonly number[] = [0x56, 0x50, 0x38, 0x58];
  public static readonly copiedImageType: string = "image/png";
  public static readonly imageCanvasContext: "2d" = "2d";
  public static readonly causeSeparator: string = "\nCaused by: ";
  public static readonly invalidInstance: string = "An instance is a string that is not blank.";
  public static readonly invalidPlace: string = "A place is a string that is not blank.";
  public static readonly settingsRowTitleInvalid: string = "A settings row's title is a string that is not blank.";
  public static readonly settingsRowsRepeated: string = "A page's settings rows each have their own id.";
  public static readonly invalidBounds: string = "Bounds need finite coordinates and a width and height that are not negative.";
  public static readonly invalidSize: string = "A size is a finite number of rem.";
  public static readonly invalidSplit: string = "A split has at least two children, one finite weight that is not negative for each and a positive total.";
  public static readonly emptyViewGroup: string = "A group of views has at least one tab.";
  public static readonly repeatedTab: string = "A tab appears only once in a layout.";
  public static readonly inactiveTab: string = "The active tab must be one of the group's tabs, and a group with tabs has one.";
  public static readonly previewOutsideGroup: string = "The preview tab must be one of the group's tabs.";
  public static readonly documentOutsideDocuments: string = "Document tabs stay in document groups.";
  public static readonly missingDocumentsGroup: string = "The middle holds at least one document group.";
  public static readonly invalidMiddleSize: string = "The middle's wanted width is from 0 to its preferred 30rem.";
  public static readonly documentsInDock: string = "Document groups stay in the middle.";
  public static readonly repeatedDock: string = "A layout has one dock for each side.";
  public static readonly repeatedNodeId: string = "Each group and split in a layout has its own id.";
  public static readonly repeatedViewType: string = "A view or document type is registered once.";
  public static readonly unknownTab: string = "A tab names a view or a document.";
  public static readonly invalidLayoutPart: string = "The value does not describe a valid part of a layout.";
  public static readonly unknownNode: string = "A node is a split, with children, or a group, with tabs.";
  public static readonly appMenu: string = "desktop.app";
  public static readonly noModules: string = "No modules";
  public static readonly copyDetailsLabel: string = "Copy details";
  public static readonly copiedLabel: string = "Copied";
  public static readonly copyPathLabel: string = "Copy path";
  public static readonly openLogFolderLabel: string = "Open log folder";
  public static readonly logFolderNotOpenedTitle: string = "The log folder didn't open";
  public static readonly selectionCopyRefused: string = "The selection was not copied: the main process refused it, and its log says why.";
  public static readonly keyBindingsNotObject: string = "the setting is not an object of commands and keys, so no key is changed";
  public static readonly keyBindingUnknownCommand: string = "it doesn't name a command as module.command";
  public static readonly keyBindingNotText: string = "its key is neither text nor null";
  public static readonly keyBindingNotChord: string = "its key is not a key chord";
  public static readonly keyBindingNotBindable: string = "its key is a typing key or one the shell keeps";
  public static readonly detailsNotCopiedTitle: string = "The details weren't copied";
  public static readonly detailsNotCopiedText: string = "The clipboard didn't take them, or they're too long to copy. The log folder has the logs to send instead.";
  public static readonly detailsCopiedTitle: string = "Details copied";
  public static readonly logFolderNotOpened: string = "The log folder could not be opened.";
  public static readonly copiedDuration: number = 2000;
  public static readonly detailsSeparator: string = "\n";
  public static readonly moduleStateLabels: Readonly<Record<ModuleState, string>> = {
    [ModuleState.Active]: "Active",
    [ModuleState.Failed]: "Failed",
    [ModuleState.Blocked]: "Blocked",
    [ModuleState.Off]: "Off",
    [ModuleState.Unavailable]: "Unavailable"
  };
  public static readonly moduleVersionTitle: string = "Version";
  public static readonly moduleStateTitle: string = "State";
  public static readonly blockedByTitle: string = "Blocked by";
  public static readonly moduleSwitchTitle: string = "Switch";
  public static readonly dependenciesTitle: string = "Depends on";
  public static readonly dependentsTitle: string = "Needed by";
  public static readonly optionalDependenciesTitle: string = "Uses if present";
  public static readonly noModulesNamed: string = "None";
  public static readonly contributionsTitle: string = "Contributes";
  public static readonly noContributions: string = "No commands, settings, menus, views or notification kinds.";
  public static readonly commandsKind: string = "commands";
  public static readonly settingsKind: string = "settings";
  public static readonly notificationsKind: string = "notifications";
  public static readonly toolsKind: string = "tools";
  public static readonly agentsStoppedLabel: string = "Agents are stopped";
  public static readonly resumeAgentsLabel: string = "Resume";
  public static readonly resumeAgentControlCommand: string = "desktop.resumeAgentControl";
  public static readonly stopAgentControlCommand: string = "desktop.stopAgentControl";
  public static readonly stopKeyWaylandNote: string = "Under Wayland the desktop decides whether the key works in other apps and never tells the app: GNOME asks once, and if it was declined, or the desktop can't share keys, the key works only here. The tray's Stop agents always works.";
  public static readonly moduleContributionKinds: readonly (readonly [string, string])[] = [
    [Resources.commandsKind, "Commands"],
    [Resources.settingsKind, "Settings"],
    ["menus", "Menus"],
    ["views", "Views"],
    [Resources.notificationsKind, "Notification kinds"]
  ];
  public static readonly programsTitle: string = "Running programs";
  public static readonly noPrograms: string = "No programs are running.";
  public static readonly programExited: string = "Exited, its processes still run";
  public static readonly pathSeparators: RegExp = /[\\/]/u;
  public static readonly minuteDuration: number = 60_000;
  public static readonly programStartFormat: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };
  public static readonly moduleSelector: string = "[data-module]";
  public static readonly moduleData: string = "module";
  public static readonly bridgeName: string = "desktop";
  public static readonly macPlatform: string = "darwin";
  public static readonly linuxPlatform: string = "linux";
  public static readonly backgroundField: string = "background";
  public static readonly titleBarField: string = "titleBar";
  public static readonly titleBarTextField: string = "titleBarText";
  public static readonly titleBarHeightField: string = "titleBarHeight";
  public static readonly colorChannelPattern: RegExp = /none|-?[\d.]+(?:e[-+]?\d+)?/g;
  public static readonly missingColorComponent: string = "none";
  public static readonly opacityTransition: string = "opacity";
  public static readonly backdropShownMutations: MutationObserverInit = { attributes: true, attributeFilter: ["class"] };
  public static readonly overlayHostMutations: MutationObserverInit = { childList: true };
  public static readonly kindField: string = "kind";
  public static readonly productVersionField: string = "productVersion";
  public static readonly fingerprintField: string = "fingerprint";
  public static readonly detailsField: string = "details";
  public static readonly payloadField: string = "payload";
  public static readonly failureField: string = "failure";
  public static readonly codeField: string = "code";
  public static readonly messageField: string = "message";
  public static readonly unknownStartupState: string = "The startup state is not one the window knows.";
  public static readonly unknownUpdateState: string = "The update state is not one the window knows.";
  public static readonly invalidUpdateProgress: string = "An update's progress is a percentage from 0 to 100.";
  public static readonly missingUpdateVersion: string = "An update that is available, downloading or ready names its version.";
  public static readonly progressField: string = "progress";
  public static readonly checkedAtField: string = "checkedAt";
  public static readonly reasonField: string = "reason";
  public static readonly mustMoveField: string = "mustMove";
  public static readonly notificationsNotConfirmed: string = "The runtime did not confirm the change to the notifications because the connection to it ended.";
  public static readonly moveAsideAction: string = "moveAside";
  public static readonly waitAction: string = "wait";
  public static readonly stopWorkAction: string = "stopWork";
  public static readonly retryAction: string = "retry";
  public static readonly moveAside: string = "Move aside";
  public static readonly waitForWork: string = "Wait for it";
  public static readonly stopWork: string = "Stop the work";
  public static readonly tryAgain: string = "Try again";
  public static readonly missingBridge: string = "The window needs the main process's bridge, which the preload provides.";
  public static readonly missingProductName: string =
    "The window needs the app's product name, desktop.product.name in its root package.json, which the app's build passes to WindowApplication.startAsync.";
  public static readonly descriptionsField: string = "descriptions";
  public static readonly isWaitingField: string = "isWaiting";
  public static readonly isUpdateField: string = "isUpdate";
  public static readonly quitTitle: string = "Work is still running";
  public static readonly quitHint: string = "Wait for it to finish, or stop it now.";
  public static readonly quitWaitingTitle: string = "Waiting for the work to finish";
  public static readonly waitThenQuit: string = "Wait, then quit";
  public static readonly stopWorkAndQuit: string = "Stop the work and quit";
  public static readonly waitThenUpdate: string = "Wait, then update";
  public static readonly stopWorkAndUpdate: string = "Stop the work and update";
  public static readonly cancel: string = "Cancel";
  public static readonly quitListLimit: number = 5;
  public static readonly waitFocusSelector: string = "[data-nol-quit=Wait]";
  public static readonly cancelReference: string = "cancel";
  public static readonly notificationsGlyph: string = "notifications";
  public static readonly updateFailedItem: string = "Update failed";
  public static readonly moveToUpdateItem: string = "Move to Applications to update";
  public static readonly updateAvailableGlyph: string = "deployed_code_update";
  public static readonly updateFailedGlyph: string = "error";
  public static readonly checkingForUpdates: string = "Checking for updates…";
  public static readonly updateFailed: string = "The update failed.";
  public static readonly updatesOff: string = "Updates are turned off in this build.";
  public static readonly platformTitles: Readonly<Record<string, string>> = { win32: "Windows", darwin: "macOS", linux: "Linux" };
  public static readonly processorTitles: Readonly<Record<string, string>> = { x64: "x64", arm64: "ARM64" };
  public static readonly notificationsOffGlyph: string = "notifications_off";
  public static readonly notificationsTitle: string = "Notifications";
  public static readonly clearAllLabel: string = "Clear all";
  public static readonly doNotDisturbLabel: string = "Do not disturb";
  public static readonly noNotifications: string = "No notifications";
  public static readonly dismissLabel: string = "Dismiss";
  public static readonly unreadLimit: number = 9;
  public static readonly toastLimit: number = 3;
  public static readonly politeAnnouncement: AriaLivePoliteness = "polite";
  public static readonly assertiveAnnouncement: AriaLivePoliteness = "assertive";
  public static readonly announcementSeparator: string = ". ";
  public static readonly hoverSelector: string = ":hover";
  public static readonly toastDuration: number = 8000;
  public static readonly toastKindInterval: number = 5000;
  public static readonly closeToastLabel: string = "Close";
  public static readonly severityGlyphs: Readonly<Record<NotificationSeverity, string>> = {
    [NotificationSeverity.Info]: "info",
    [NotificationSeverity.Success]: "check_circle",
    [NotificationSeverity.Warning]: "warning",
    [NotificationSeverity.Error]: "error"
  };
  public static readonly severityNames: Readonly<Record<NotificationSeverity, string>> = {
    [NotificationSeverity.Info]: "Information",
    [NotificationSeverity.Success]: "Success",
    [NotificationSeverity.Warning]: "Warning",
    [NotificationSeverity.Error]: "Error"
  };
  public static readonly webViewElement: "webview" = "webview";
  public static readonly webViewPartitionAttribute: string = "partition";
  public static readonly webViewSourceAttribute: string = "src";
  public static readonly webViewPopupsAttribute: string = "allowpopups";
  public static readonly webViewStartAddress: string = "about:blank";
  public static readonly webViewAttachEvent: string = "dom-ready";
  public static readonly webViewFrameClass: string = "nol-web-view";
  public static readonly webViewGuestClass: string = "nol-web-view-guest";
  public static readonly webViewLayerClass: string = "nol-web-view-layer";
  public static readonly webViewFrameStyle: Readonly<Record<string, string>> = { position: "absolute", inset: "0", display: "block", overflow: "hidden" };
  public static readonly webViewGuestStyle: Readonly<Record<string, string>> = { position: "absolute", inset: "0", display: "flex" };
  public static readonly webViewLayerStyle: Readonly<Record<string, string>> = { position: "absolute", inset: "0", overflow: "hidden", "pointer-events": "none" };
  public static readonly visibilityProperty: string = "visibility";
  public static readonly hiddenVisibility: string = "hidden";
  public static readonly pointerEventsProperty: string = "pointer-events";
  public static readonly noPointerEvents: string = "none";
  public static readonly zIndexProperty: string = "z-index";
  public static readonly behindZIndex: string = "-1";
  public static readonly isControlledField: string = "isControlled";
  public static readonly webViewViewField: string = "view";
  public static readonly webViewPartitionField: string = "partition";
  public static readonly webViewKeysField: string = "keys";
  public static readonly webViewIsAttachedField: string = "isAttached";
  public static readonly webViewClosed: string = "The web view is closed.";
  public static readonly webViewZoomInvalid: string = "A web view's zoom is a finite factor above 0, 1 for 100%.";
  public static readonly webViewZoomIn: string = "in";
  public static readonly webViewZoomOut: string = "out";
  public static readonly webViewFindNext: string = "next";
  public static readonly webViewFindPrevious: string = "previous";
  public static readonly webViewTextField: string = "text";
  public static readonly webViewMatchCaseField: string = "matchCase";
  public static readonly webViewMatchesField: string = "matches";
  public static readonly webViewActiveField: string = "active";
  public static readonly webViewIsTimedOutField: string = "isTimedOut";
  public static readonly webViewIsEndedField: string = "isEnded";
  public static readonly webViewNotOpened: string =
    "The web view was not opened: its module declares no webViews.json, its pane is not open or holds as many views as it may, or its profile key is not valid.";
  public static readonly activeParameterName: string = "active";
  public static readonly docksParameterName: string = "docks";
  public static readonly documentPlacesParameterName: string = "documentPlaces";
  public static readonly documentsParameterName: string = "documents";
  public static readonly factorParameterName: string = "factor";
  public static readonly idParameterName: string = "id";
  public static readonly instanceParameterName: string = "instance";
  public static readonly middleParameterName: string = "middle";
  public static readonly middleSizeParameterName: string = "middleSize";
  public static readonly moduleIdParameterName: string = "moduleId";
  public static readonly nameParameterName: string = "name";
  public static readonly optionsParameterName: string = "options";
  public static readonly partsParameterName: string = "parts";
  public static readonly preferredWidthsParameterName: string = "preferredWidths";
  public static readonly previewParameterName: string = "preview";
  public static readonly renamableDocumentsParameterName: string = "renamableDocuments";
  public static readonly sizeParameterName: string = "size";
  public static readonly tabParameterName: string = "tab";
  public static readonly tabsParameterName: string = "tabs";
  public static readonly pngHeaderChunkOffset: number = 12;
  public static readonly pngHeaderLength: number = 24;
  public static readonly pngWidthOffset: number = 16;
  public static readonly pngHeightOffset: number = 20;
  public static readonly jpegFirstMarkerOffset: number = 2;
  public static readonly jpegMarkerPrefix: number = 0xff;
  public static readonly jpegMarkerLookahead: number = 3;
  public static readonly jpegMarkerLength: number = 2;
  public static readonly jpegFrameLength: number = 9;
  public static readonly jpegFrameWidthOffset: number = 7;
  public static readonly jpegFrameHeightOffset: number = 5;
  public static readonly gifHeaderLength: number = 13;
  public static readonly gifFlagsOffset: number = 10;
  public static readonly gifColorEntryBytes: number = 3;
  public static readonly gifColorTableSizeMask: number = 0x07;
  public static readonly gifExtensionHeaderLength: number = 2;
  public static readonly gifDescriptorLength: number = 9;
  public static readonly gifScreenWidthOffset: number = 6;
  public static readonly gifScreenHeightOffset: number = 8;
  public static readonly gifLeftOffset: number = 1;
  public static readonly gifTopOffset: number = 3;
  public static readonly gifWidthOffset: number = 5;
  public static readonly gifHeightOffset: number = 7;
  public static readonly webpMinimumLength: number = 30;
  public static readonly webpChunkOffset: number = 12;
  public static readonly webpLossyWidthOffset: number = 26;
  public static readonly webpLossyHeightOffset: number = 28;
  public static readonly webpDimensionMask: number = 0x3fff;
  public static readonly webpLosslessBitsOffset: number = 21;
  public static readonly webpLosslessHighOffset: number = 23;
  public static readonly webpLosslessHeightDivisor: number = 0x4000;
  public static readonly webpExtendedWidthOffset: number = 24;
  public static readonly webpExtendedHeightOffset: number = 27;
  public static readonly uint16Range: number = 0x10000;

  public static formatToolbarBandSelector(id: string): string {
    return `.nol-toolbar-band[data-toolbar-band-id="${id}"]`;
  }

  public static formatSpellingFallback(language: string): string {
    return `None of this device's languages has a dictionary here, so words are checked in ${language}.`;
  }

  public static formatOpenLinkInAppTitle(productName: string): string {
    return `Open in ${productName}`;
  }

  public static formatSettingCheckFailed(setting: string, error: unknown): string {
    return `The check of the setting ${setting} failed, so Settings accepted its value unchecked: ${error instanceof Error ? error.name : typeof error}.`;
  }

  public static formatInAppLinkFailed(error: unknown): string {
    return `The in-app browser did not open a link, which opened in the system's browser instead: ${error instanceof Error ? error.name : typeof error}.`;
  }

  public static formatLinkNotOpened(productName: string): string {
    return `${productName} did not open the link: it opens only well-formed http, https and mailto links, in the system's own application.`;
  }

  public static formatWindowPartSaveFailed(productName: string): string {
    return `Its window part failed to save while ${productName} was closing.`;
  }

  public static formatWindowPartSaveFailedLate(productName: string): string {
    return `Its window part failed to save after ${productName} stopped waiting for it.`;
  }

  public static formatWindowPartSaveUnfinished(productName: string): string {
    return `Its window part did not finish saving within ${Resources.partSaveTimeout / 1000} seconds while ${productName} was closing; ${productName} closed without it.`;
  }

  public static formatWindowPartSaveFailedForUpdate(productName: string): string {
    return `Its window part failed to save while ${productName} was preparing to install an update.`;
  }

  public static formatWindowPartSaveUnfinishedForUpdate(productName: string): string {
    return `Its window part did not finish saving within ${Resources.partSaveTimeout / 1000} seconds while ${productName} was preparing to install an update; the update stopped.`;
  }

  public static formatLogFolderNotOpenedText(productName: string): string {
    return `${productName} couldn't open the logs folder in its data folder. Copy details names the data folder.`;
  }

  public static formatPartSaveUnfinishedText(productName: string): string {
    return `${productName} closed after waiting ${Resources.partSaveTimeout / 1000} seconds for it.`;
  }

  public static formatInvalidUpdateMove(productName: string): string {
    return `Only an available or failed update says ${productName} must move to Applications, and an available one always does.`;
  }

  public static formatStartingTitle(productName: string): string {
    return `Starting ${productName}…`;
  }

  public static formatUpdatingText(productName: string): string {
    return `Saving your work and closing ${productName}`;
  }

  public static formatPreShellDataTitle(productName: string): string {
    return `Data from an earlier ${productName}`;
  }

  public static formatPreShellDataText(productName: string): string {
    return `This release does not open data that an earlier ${productName} wrote. Moving it aside keeps all of it in a new folder beside it, ` +
      `changes and deletes nothing, and starts ${productName} with an empty data folder.`;
  }

  public static formatWorkInProgressTitle(productName: string): string {
    return `An older ${productName} is still working`;
  }

  public static formatWorkInProgressText(productName: string): string {
    return `This ${productName} replaces it. Wait for this work to finish, or stop it now.`;
  }

  public static formatWaitingTitle(productName: string): string {
    return `Waiting for the older ${productName}`;
  }

  public static formatWaitingText(productName: string): string {
    return `${productName} starts when this work finishes.`;
  }

  public static formatNewerBuildTitle(productName: string): string {
    return `A newer ${productName} is running`;
  }

  public static formatFailedTitle(productName: string): string {
    return `${productName} could not start`;
  }

  public static formatQuitText(productName: string): string {
    return `${productName} is still working on:`;
  }

  public static formatQuitWaitingText(productName: string): string {
    return `${productName} quits when this work finishes:`;
  }

  public static formatUpdateWaitingText(productName: string): string {
    return `${productName} updates when this work finishes:`;
  }

  public static formatPatternPreview(text: string): string {
    return `Shows as ${text}`;
  }

  public static formatSettingRowControlSelector(name: string): string {
    return `[data-setting="${CSS.escape(name)}"] .nol-setting-row-control :is(${Resources.tabbableSelector})`;
  }

  public static formatNotificationDismissSelector(id: string): string {
    return `[data-notification="${CSS.escape(id)}"] .nol-notifications-dismiss`;
  }

  public static formatAttributeSelector(attribute: string, value: string): string {
    return `[${attribute}="${value}"]`;
  }

  public static formatShortcutKeySelector(command: string): string {
    return `${Resources.formatAttributeSelector(Resources.commandAttribute, command)} .${Resources.shortcutKeyClass}`;
  }

  public static formatPixels(value: number): string {
    return `${value}px`;
  }

  public static formatShortcutTitle(title: string, key: string): string {
    return `${title} (${key})`;
  }

  public static formatSearchRowId(source: string, id: string): string {
    return `${source}/${id}`;
  }

  public static formatJsonPath(path: string, name: string): string {
    return `${path}.${name}`;
  }

  public static formatSharedFileUrl(grant: string): string {
    return `${Resources.sharedFileScheme}://${grant}/`;
  }

  public static formatTabInstanceTitle(title: string, instance: string | number): string {
    return `${title} ${instance}`;
  }

  public static formatAnnouncement(title: string, text: string): string {
    return `${title}. ${text}`;
  }

  public static formatErrorText(name: string, message: string): string {
    return `${name}: ${message}`;
  }

  public static formatRgb(channels: readonly number[]): string {
    return `rgb(${channels.join(Resources.colorListSeparator)})`;
  }

  public static formatRgba(channels: readonly number[], alpha: number): string {
    return `rgba(${[...channels, alpha].join(Resources.colorListSeparator)})`;
  }

  public static formatSrgbColor(color: string): string {
    return `color-mix(in srgb, ${color}, ${color})`;
  }

  public static formatPartSaveFailed(productName: string, moduleName: string): string {
    return `${moduleName} couldn't save, so ${productName} stayed open`;
  }

  public static formatPartSaveFailedStayedOn(moduleName: string): string {
    return `${moduleName} couldn't save, so nothing was turned off`;
  }

  public static formatPartSaveFailedBeforeStop(moduleName: string): string {
    return `${moduleName} couldn't save before it stopped`;
  }

  public static formatPartSaveFailedForUpdate(moduleName: string): string {
    return `${moduleName} couldn't save`;
  }

  public static formatSelectionNotCopied(reason: string): string {
    return `The selection was not copied: ${reason}`;
  }

  public static formatKeyBindingSkipped(command: string, reason: string): string {
    return `The key binding of "${command}" was skipped: ${reason}.`;
  }

  public static formatFileNotOpened(productName: string, reason: string): string {
    return `${productName} didn't open the file: ${reason}`;
  }

  public static formatFileNotShown(productName: string, reason: string): string {
    return `${productName} didn't show the file in its folder: ${reason}`;
  }

  public static formatPartSaveUnfinished(moduleName: string): string {
    return `${moduleName} didn't finish saving`;
  }

  public static formatWindowTitle(productName: string, title: string): string {
    return `${title} — ${productName}`;
  }

  public static formatMoreWork(count: number): string {
    return `and ${count} more`;
  }

  public static formatModulesDidNotStart(count: number): string {
    return count === 1 ? "1 module didn't start" : `${count} modules didn't start`;
  }

  public static formatModuleDidNotStart(displayName: string): string {
    return `${displayName} didn't start`;
  }

  public static formatModuleOff(displayName: string): string {
    return `${displayName} is off`;
  }

  public static formatUpdateReady(productName: string, version: string | null): string {
    return Object.isNull(version) ? `${productName} is ready to install.` : `${productName} ${version} is ready to install.`;
  }

  public static formatDownloadingVersion(productName: string, version: string | null): string {
    return Object.isNull(version) ? `Downloading ${productName}` : `Downloading ${productName} ${version}`;
  }

  public static formatDownloadingLine(productName: string, version: string | null): string {
    return `${Resources.formatDownloadingVersion(productName, version)}…`;
  }

  public static formatDownloadPercent(progress: number): string {
    return ` ${progress}%`;
  }

  public static formatLastChecked(checkedAt: string): string {
    return `Last checked ${checkedAt}.`;
  }

  public static formatPlatform(platform: string, processor: string): string {
    return `${Resources.platformTitles[platform] ?? platform} ${Resources.processorTitles[processor] ?? processor}`;
  }

  public static formatRunningFor(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (minutes < 1)
      return "Less than a minute";
    if (hours < 1)
      return `${minutes} min`;
    if (days < 1)
      return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
    return hours % 24 === 0 ? `${days} d` : `${days} d ${hours % 24} h`;
  }

  public static formatProgramDetails(path: string, processId: number, time: string): string {
    return `${path} · Process ${processId}, started ${time}`;
  }

  public static formatCopyPathTooltip(label: string, details: string): string {
    return `${label} · ${details}`;
  }

  public static formatProgramCount(count: number): string {
    return count === 1 ? "1 program" : `${count} programs`;
  }

  public static formatProductVersion(productName: string, productVersion: string): string {
    return `${productName} ${productVersion}`;
  }

  public static formatPlatformDetails(platform: string, processor: string): string {
    return `Platform: ${platform} ${processor}`;
  }

  public static formatModuleDetails(moduleId: string, version: string, state: string, cause: string | null): string {
    return Object.isNull(cause) ? `${moduleId} ${version}: ${state}` : `${moduleId} ${version}: ${state}: ${cause}`;
  }

  public static formatModuleBlocked(dependency: string): string {
    return `It depends on ${dependency}, which is not active.`;
  }

  public static formatForeignContribution(moduleId: string, name: string): string {
    return `The module ${moduleId} may contribute only names of its own, not ${name}.`;
  }

  public static formatCommandNotFinished(name: string): string {
    return `The command ${name} did not finish because the connection to the runtime ended.`;
  }

  public static formatSettingNotConfirmed(name: string): string {
    return `The runtime did not confirm the change to the setting ${name} because the connection to it ended.`;
  }

  public static formatCommandNotFound(name: string): string {
    return `No command named ${name} is registered; its module may not be active.`;
  }

  public static formatCommandNotEnabled(name: string): string {
    return `The command ${name} is not enabled for these arguments.`;
  }

  public static formatUndeclaredCommand(moduleId: string, name: string): string {
    return `The module ${moduleId} does not declare the command ${name}.`;
  }

  public static formatUpToDate(productName: string): string {
    return `${productName} is up to date.`;
  }

  public static formatMoveToApplications(productName: string): string {
    return `Move ${productName} to Applications to get updates.`;
  }

  public static formatAboutLabel(productName: string): string {
    return `About ${productName}`;
  }

  public static formatUnreadCount(count: number): string {
    return count > Resources.unreadLimit ? `${Resources.unreadLimit}+` : String(count);
  }

  public static formatNotificationsLabel(unread: number, isQuiet: boolean): string {
    const state = isQuiet ? ", Do not disturb" : String.empty;
    return unread === 0 ? `Notifications${state}` : `Notifications, ${unread} unread${state}`;
  }

  public static formatDocumentsGroup(position: number): string {
    return `${Resources.documentsGroupLabel} ${position}`;
  }

  public static formatTabFocusArea(key: string): string {
    return `[data-tab-key="${CSS.escape(key)}"], [data-tab-content="${CSS.escape(key)}"]`;
  }

  public static formatDockStripView(side: DockSide, key: string): string {
    return `nol-dock[data-side="${side}"] .nol-dock-strip-view[data-view="${CSS.escape(key)}"]`;
  }

  public static formatBadged(label: string, badge: string): string {
    return `${label}, ${badge}`;
  }

  public static formatUnavailableOption(value: string): string {
    return `${value.length === 0 ? Resources.emptyOptionValue : value} (unavailable)`;
  }

  public static formatSettingOptionsFailed(setting: string): string {
    return `Supplying the options of the setting ${setting} failed; Settings shows its value alone until they are supplied again.`;
  }

  public static formatSettingOptionsRepeated(setting: string): string {
    return `The options supplied for the setting ${setting} share a value; Settings shows its value alone until they are supplied again.`;
  }

  public static formatUndeclaredContribution(moduleId: string, kind: string, name: string): string {
    return `The module ${moduleId} does not declare the ${kind} ${name}.`;
  }

  public static formatContributionRegistered(kind: string, name: string): string {
    return `The ${kind} ${name} is already registered.`;
  }

  public static formatPlaceholderRegistered(name: string, registered: string): string {
    return `The placeholder ${name} is refused, since the window shows one and ${registered} is already registered.`;
  }

  public static formatSearchPlaceholder(names: readonly string[]): string {
    const listed = names.length < 2 ? names.join(String.empty) : [names.slice(0, -1).join(", "), ...names.slice(-1)].join(" and ");
    return `Search ${listed}`;
  }

  public static formatSearchSourceFailed(name: string, error: unknown): string {
    return `The search source ${name} failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  public static formatSettingSearchTitle(page: string, title: string): string {
    return `${page}: ${title}`;
  }

  public static formatSettingSearchDetail(page: string): string {
    return `Settings › ${page}`;
  }

  public static formatSearchSourceRegistered(name: string): string {
    return `The search source ${name} is already registered.`;
  }

  public static formatCommandRegistered(name: string): string {
    return `The command ${name} is already registered.`;
  }

  public static formatForeignSecret(moduleId: string, name: string): string {
    return `The module ${moduleId} may only use its own secrets, not ${name}.`;
  }

  public static formatForeignName(moduleId: string, name: string): string {
    return `The module ${moduleId} may use only its own methods and events and those of the modules it depends on, not ${name}.`;
  }

  public static formatUpdatingTitle(productName: string, version: string): string {
    return `Installing ${productName} ${version}`;
  }

  public static formatNewerBuild(productName: string, version: string): string {
    return `${productName} ${version} is using this data folder. Use that ${productName} instead.`;
  }

  public static formatUnregisteredView(name: string): string {
    return `No view named "${name}" is registered.`;
  }

  public static formatUnsupportedVersion(version: number): string {
    return `Layout format version ${version} is not supported; this build reads version ${Resources.layoutFormatVersion}.`;
  }

  public static formatModuleNotifications(displayName: string): string {
    return `${displayName} notifications`;
  }

  public static formatResetLabel(title: string): string {
    return `Reset ${title}`;
  }

  public static formatNumberRange(minimum: number | null, maximum: number | null, step: number | null): string {
    return step === 1 ? `Enter a whole number from ${minimum} to ${maximum}.` : `Enter a number from ${minimum} to ${maximum} in steps of ${step}.`;
  }

  public static formatKeyTaken(key: string, keptBy: string): string {
    return `${key} is taken by ${keptBy}`;
  }

  public static readonly paneNoteSeparator: string = "; ";

  public static formatKeyTakenInPages(key: string, module: string): string {
    return `${module} takes ${key} in its pages`;
  }

  public static formatWithKey(label: string, key: string | null): string {
    return Object.isNull(key) ? label : `${label} (${key})`;
  }

  public static formatKeyUsed(key: string, holder: string): string {
    return `${key} is used by ${holder}`;
  }

  public static formatKeyReserved(key: string, owner: string): string {
    return `${key} belongs to ${owner}`;
  }

  public static formatChangeKeyLabel(title: string, key: string): string {
    return `Change the key of ${title}, now ${key}`;
  }

  public static formatRecordingLabel(title: string, hint: string): string {
    return `${hint} for ${title}`;
  }

  public static formatLookValue(name: string): string {
    return `var(--nol-${name})`;
  }

  public static formatRemoveKeyLabel(title: string): string {
    return `Remove the key of ${title}`;
  }

  public static formatForeignDocument(moduleId: string, name: string): string {
    return `The module "${moduleId}" can open only its own documents, not "${name}".`;
  }

  public static formatUnregisteredDocument(name: string): string {
    return `No document named "${name}" is registered.`;
  }

  public static formatDraggedTab(label: string): string {
    return `Moving ${label}`;
  }
}
