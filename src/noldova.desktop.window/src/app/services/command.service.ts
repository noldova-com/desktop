/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { DestroyRef, ErrorHandler, Injectable, type Signal, type WritableSignal, computed, effect, inject, signal, untracked } from "@angular/core";

import "@noldova/context.core";
import { DialogService } from "@noldova/ui.components.angular";
import type { JsonValue } from "@noldova/context.json";
import type { KeyChord } from "@noldova/desktop.protocol";

import { UnconfirmedAction } from "../enums/unconfirmed-action.js";
import { ActionNotConfirmedException } from "../exceptions/action-not-confirmed.exception.js";
import { CommandNotFoundException } from "../exceptions/command-not-found.exception.js";
import type { ICommandKey } from "../interfaces/i-command-key.js";
import type { CommandContribution } from "../models/command-contribution.js";
import { KeyBindings } from "../models/key-bindings.js";
import { ShortcutMap } from "../models/shortcut-map.js";
import { Resources } from "../../resources.js";
import { PreloadBridgeService } from "./preload-bridge.service.js";
import { ModuleStatusService } from "./module-status.service.js";
import { SettingsService } from "./settings.service.js";
import { ShellCommandsService } from "./shell-commands.service.js";
import { StartupService } from "./startup.service.js";
import { ViewDialogService } from "./view-dialog.service.js";

@Injectable({ providedIn: "root" })
export class CommandService {
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly viewDialogs: ViewDialogService = inject(ViewDialogService);
  private readonly shell: ShellCommandsService = inject(ShellCommandsService);
  private readonly startup: StartupService = inject(StartupService);
  private readonly shellCommands: readonly CommandContribution[] = this.shell.commands;
  private readonly moduleCommands: WritableSignal<readonly CommandContribution[]> = signal([]);
  private readonly settingValues: Signal<ReadonlyMap<string, JsonValue>> = inject(SettingsService).values;
  private readonly bindingsValue: Signal<JsonValue | undefined> = computed(() => this.settingValues().get(Resources.keyBindingsSetting));
  private readonly statuses: ModuleStatusService = inject(ModuleStatusService);

  public readonly commands: Signal<readonly CommandContribution[]> = computed(() => [...this.shellCommands, ...this.moduleCommands()]);
  public readonly bindings: Signal<KeyBindings> = computed(() => KeyBindings.fromJson(this.bindingsValue()));
  public readonly shortcuts: Signal<ShortcutMap> = computed(() => new ShortcutMap(this.shell.keys(this.bridge.platform), this.commands(), this.bindings().list, this.bridge.platform,
    this.shell.pageFirstKeys(this.bridge.platform)));

  public constructor() {
    const document = inject(DOCUMENT);
    const listener = (event: KeyboardEvent): void => {
      this.dispatch(event);
    };
    document.addEventListener(Resources.keyDownEvent, listener);
    inject(DestroyRef).onDestroy(() => document.removeEventListener(Resources.keyDownEvent, listener));
    effect(() => {
      const pairs = this.shortcuts().pairs;
      untracked(() => this.bridge.setAppShortcuts(pairs));
    });
    effect(() => {
      const skipped = this.bindings().skipped;
      untracked(() => {
        for (const [command, reason] of skipped)
          this.bridge.logError(null, Resources.formatKeyBindingSkipped(command, reason));
      });
    });
  }

  public setCommands(commands: readonly CommandContribution[]): void {
    this.moduleCommands.set([...commands]);
  }

  public async runAsync(name: string, commandArguments: JsonValue = null): Promise<JsonValue> {
    const command = this.find(name);
    return this.isHeldByReconnect(command.name) ? null : CommandService.runCommandAsync(command, commandArguments);
  }

  public run(name: string, commandArguments: JsonValue = null): void {
    this.report(this.runAsync(name, commandArguments));
  }

  public isEnabled(name: string, commandArguments: JsonValue = null): boolean {
    return this.canRun(this.find(name), commandArguments);
  }

  public isAvailable(name: string, commandArguments: JsonValue = null): boolean {
    const command = this.commands().find(t => t.name === name);
    return !Object.isUndefined(command) && this.canRun(command, commandArguments);
  }

  public isChecked(name: string, commandArguments: JsonValue = null): boolean {
    return this.ask(() => this.find(name).isChecked?.(commandArguments) ?? false);
  }

  public isApplicable(name: string, commandArguments: JsonValue = null): boolean {
    return this.ask(() => this.find(name).isApplicable(commandArguments));
  }

  public titleOf(name: string): string {
    return this.find(name).title;
  }

  public ownerOf(name: string): string {
    const owner = name.slice(0, name.indexOf(Resources.contributionSeparator));
    return this.statuses.nameOf(owner);
  }

  public defaultKeysOf(name: string): readonly KeyChord[] {
    const command = this.find(name);
    return [...this.shell.keys(this.bridge.platform).filter(t => t[1] === command.name).map(t => t[0]), ...Object.isNull(command.defaultKey) ? [] : [command.defaultKey]];
  }

  public keyLabel(name: string): string | null {
    return this.shortcuts().keyOf(this.find(name).name)?.label(this.bridge.platform) ?? null;
  }

  public keyOf(name: string): ICommandKey | null {
    const key = this.shortcuts().keyOf(name);
    return Object.isNull(key) ? null : { label: key.label(this.bridge.platform), ariaKeyShortcuts: key.ariaKeyShortcuts(this.bridge.platform) };
  }

  public isHeldByDialog(name: string): boolean {
    return this.dialogs.isOpen && !Resources.modalCommands.includes(name) && !this.viewDialogs.ownsCommand(name);
  }

  public dispatch(event: KeyboardEvent): boolean {
    if (event.defaultPrevented || event.repeat)
      return false;
    const command = this.commandOf(event);
    if (Object.isNull(command))
      return false;

    event.preventDefault();
    this.report(CommandService.runCommandAsync(command, null));
    return true;
  }

  public findWindowCommand(event: KeyboardEvent): string | null {
    return this.commandOf(event)?.name ?? null;
  }

  private commandOf(event: KeyboardEvent): CommandContribution | null {
    if (event.isComposing)
      return null;
    const name = this.nameOf(event);
    const command = this.commands().find(t => t.name === name);
    return Object.isUndefined(command) || this.isHeldByDialog(command.name) || !this.canRun(command, null) ? null : command;
  }

  private nameOf(event: KeyboardEvent): string | undefined {
    const shortcuts = this.shortcuts();
    const own = shortcuts.find(event);
    if (this.bridge.isMac || !event.composedPath().some(t => t instanceof Element && t.hasAttribute(Resources.keepsCtrlKeysAttribute)))
      return own;
    const isCtrlShift = event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey;
    const name = Object.isUndefined(own) && isCtrlShift
      ? shortcuts.find({ key: event.key, code: event.code, ctrlKey: true, altKey: false, shiftKey: false, metaKey: false })
      : own;
    return Object.isUndefined(name) || Object.values(Resources.editCommands).includes(name) ? undefined : name;
  }

  private canRun(command: CommandContribution, commandArguments: JsonValue): boolean {
    return !this.isHeldByReconnect(command.name) && this.ask(() => command.isEnabled(commandArguments));
  }

  private isHeldByReconnect(name: string): boolean {
    return this.startup.isReconnecting() && !Resources.modalCommands.includes(name);
  }

  private ask(question: () => boolean): boolean {
    try {
      return question();
    }
    catch (error) {
      this.errors.handleError(error);
      return false;
    }
  }

  private static async runCommandAsync(command: CommandContribution, commandArguments: JsonValue): Promise<JsonValue> {
    try {
      return await command.runAsync(commandArguments);
    }
    catch (error) {
      throw ActionNotConfirmedException.from(error, UnconfirmedAction.Command, command.name);
    }
  }

  private report(running: Promise<JsonValue>): void {
    running.catch((error: unknown) => this.errors.handleError(error));
  }

  private find(name: string): CommandContribution {
    const command = this.commands().find(t => t.name === name);
    if (Object.isUndefined(command))
      throw new CommandNotFoundException(name);
    return command;
  }
}
