/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { EditAction, WindowAction } from "@noldova/desktop.protocol";

import type { IContextMenuParams } from "../interfaces/i-context-menu-params.js";
import type { IMainProcessWindow } from "../interfaces/i-main-process-window.js";
import type { IMenuHost } from "../interfaces/i-menu-host.js";
import type { IWindowContents } from "../interfaces/i-window-contents.js";
import type { MainProcessSettings } from "../models/main-process-settings.js";
import { MenuBar } from "../models/menu-bar.js";
import type { WindowRegistry } from "../models/window-registry.js";
import { Resources } from "../resources.js";
import { MenuBarTemplate } from "./menu-bar-template.js";
import type { OpenWindow } from "./open-window.js";
import type { SpellChecker } from "./spell-checker.js";

export class WindowControls {
  private static readonly EDITS: ReadonlyMap<string, (contents: IWindowContents) => void> = new Map<string, (contents: IWindowContents) => void>([
    [EditAction.Undo, t => t.undo()],
    [EditAction.Redo, t => t.redo()],
    [EditAction.Cut, t => t.cut()],
    [EditAction.Copy, t => t.copy()],
    [EditAction.Paste, t => t.paste()],
    [EditAction.SelectAll, t => t.selectAll()]
  ]);
  private static readonly WINDOW_ACTIONS: ReadonlyMap<string, (window: IMainProcessWindow) => void> = new Map<string, (window: IMainProcessWindow) => void>([
    [WindowAction.Minimize, t => t.minimize()],
    [WindowAction.ToggleMaximized, t => {
      if (t.isMaximized())
        t.unmaximize();
      else
        t.maximize();
    }],
    [WindowAction.Close, t => t.close()]
  ]);

  private readonly menu: IMenuHost;
  private readonly settings: MainProcessSettings;
  private readonly windows: WindowRegistry;
  private readonly spelling: SpellChecker;
  private readonly log: (text: string) => void;

  public constructor(menu: IMenuHost, settings: MainProcessSettings, windows: WindowRegistry, spelling: SpellChecker, log: (text: string) => void) {
    this.menu = menu;
    this.settings = settings;
    this.windows = windows;
    this.spelling = spelling;
    this.log = log;
  }

  public edit(open: OpenWindow | null, action: unknown): boolean {
    const run = Object.isString(action) ? WindowControls.EDITS.get(action) : undefined;
    if (Object.isNull(open) || Object.isUndefined(run))
      return false;
    run(open.window.webContents);
    return true;
  }

  public actOnWindow(open: OpenWindow | null, action: unknown): boolean {
    const run = Object.isString(action) ? WindowControls.WINDOW_ACTIONS.get(action) : undefined;
    if (Object.isNull(open) || Object.isUndefined(run))
      return false;
    run(open.window);
    return true;
  }

  public keepSpelling(open: OpenWindow | null, isChecking: unknown, languages: unknown): void {
    if (Object.isNull(open))
      return;
    if (!Object.isBoolean(isChecking) || !Array.isArray(languages) || !languages.every(t => Object.isString(t))) {
      this.log(Resources.formatSpellingRejected(Resources.spellingInvalid));
      return;
    }
    this.spelling.apply(isChecking, languages);
  }

  public replaceMisspelling(open: OpenWindow | null, text: unknown): boolean {
    if (Object.isNull(open) || !Object.isString(text) || text.length === 0 || text.length > Resources.spellingTextLimit)
      return false;
    open.window.webContents.replaceMisspelling(text);
    return true;
  }

  public addToDictionary(open: OpenWindow | null, word: unknown): boolean {
    return !Object.isNull(open) && Object.isString(word) && Resources.dictionaryWordPattern.test(word) && this.spelling.addWord(word);
  }

  public showMenuBar(open: OpenWindow | null, contentsId: number, menuBar: unknown): void {
    if (Object.isNull(open) || !this.settings.isMac)
      return;
    try {
      const template = MenuBarTemplate.build(MenuBar.fromJson(menuBar), id => this.windows.find(contentsId)?.window.webContents.send(Resources.menuCommandChannel, id));
      this.menu.setApplicationMenu(this.menu.buildFromTemplate(template));
    }
    catch (error) {
      this.log(Resources.formatMenuBarRejected(String(error)));
    }
  }

  public forwardFieldMenu(open: OpenWindow, params: IContextMenuParams): void {
    open.window.webContents.send(Resources.fieldMenuChannel, {
      [Resources.xField]: params.x,
      [Resources.yField]: params.y,
      [Resources.isKeyboardField]: params.menuSourceType === Resources.keyboardMenuSource,
      [Resources.wordField]: params.misspelledWord,
      [Resources.suggestionsField]: [...params.dictionarySuggestions]
    });
  }
}
