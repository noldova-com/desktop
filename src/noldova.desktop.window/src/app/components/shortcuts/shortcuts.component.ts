/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ElementRef, ErrorHandler, type Signal, type WritableSignal, effect, inject, input, signal } from "@angular/core";

import "@noldova/context.core";
import {
  ButtonComponent, ButtonVariant, ConfigurationTableActionDirective, ConfigurationTableComponent, ConfigurationTableDirective, ConfigurationTableFillDirective, TooltipDirective
} from "@noldova/ui.components.angular";
import { KeyChord, QualifiedName } from "@noldova/desktop.protocol";

import { KeyBindings } from "../../models/key-bindings.js";
import { ShortcutNotice } from "../../models/settings/shortcut-notice.js";
import type { ShortcutRow } from "../../models/settings/shortcut-row.js";
import { Resources } from "../../../resources.js";
import { CommandService } from "../../services/command.service.js";
import { PreloadBridgeService } from "../../services/preload-bridge.service.js";
import { SettingsService } from "../../services/settings.service.js";
import { HighlightedTextComponent } from "../highlighted-text/highlighted-text.component.js";

@Component({
  selector: "nol-shortcuts",
  imports: [ButtonComponent, ConfigurationTableActionDirective, ConfigurationTableComponent, ConfigurationTableDirective, ConfigurationTableFillDirective, HighlightedTextComponent, TooltipDirective],
  templateUrl: "./shortcuts.component.html",
  styleUrl: "./shortcuts.component.css",
  host: {
    "class": "nol-shortcuts"
  }
})
export class ShortcutsComponent {
  private static count: number = 0;

  private readonly index: number = ShortcutsComponent.count++;
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly commands: CommandService = inject(CommandService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly platform: string = inject(PreloadBridgeService).platform;
  private pending: KeyBindings | null = null;

  protected readonly resources: typeof Resources = Resources;
  protected readonly isLinux: boolean = this.platform === Resources.linuxPlatform;
  protected readonly primary: ButtonVariant = ButtonVariant.Primary;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly recording: WritableSignal<string | null> = signal(null);
  protected readonly hint: WritableSignal<string> = signal(Resources.recordingHint);
  protected readonly notice: WritableSignal<ShortcutNotice | null> = signal(null);
  protected readonly isModified: Signal<boolean> = this.settings.isSet(Resources.keyBindingsSetting);

  public readonly rows = input.required<readonly ShortcutRow[]>();
  public readonly query = input<string>(String.empty);

  public constructor() {
    effect(() => this.settle(this.commands.bindings()));
  }

  private get bindings(): KeyBindings {
    return this.pending ?? this.commands.bindings();
  }

  protected record(row: ShortcutRow): void {
    this.notice.set(null);
    this.hint.set(Resources.recordingHint);
    this.recording.set(row.name);
  }

  protected press(row: ShortcutRow, event: KeyboardEvent): void {
    if (this.recording() !== row.name || (event.key === Resources.tabKey && !event.ctrlKey && !event.altKey && !event.metaKey))
      return;
    event.preventDefault();
    event.stopPropagation();
    if (Resources.modifierKeys.includes(event.key)) {
      this.hint.set(this.heldLabel(event));
      return;
    }
    this.recording.set(null);
    if (event.key !== Resources.escapeKey || event.ctrlKey || event.altKey || event.shiftKey || event.metaKey)
      this.choose(row.name, event);
  }

  protected release(row: ShortcutRow, event: KeyboardEvent): void {
    if (this.recording() === row.name && Resources.modifierKeys.includes(event.key))
      this.hint.set(this.heldLabel(event));
  }

  protected stopRecording(row: ShortcutRow): void {
    if (this.recording() === row.name)
      this.recording.set(null);
  }

  protected remove(row: ShortcutRow): void {
    this.write(this.bindings.with(row.name, null), row.name);
  }

  protected reset(row: ShortcutRow): void {
    this.write(this.bindings.without(row.name), row.name);
  }

  protected resetAll(): void {
    this.notice.set(null);
    this.track(KeyBindings.fromJson({}), this.settings.resetAsync(Resources.keyBindingsSetting));
  }

  protected useHere(notice: ShortcutNotice, holder: string): void {
    const bindings = this.bindings.with(notice.command, notice.key);
    const keepsDefaults = !bindings.has(holder) && this.commands.defaultKeysOf(holder).length > 1;
    this.write(keepsDefaults ? bindings : bindings.with(holder, null), notice.command);
  }

  protected dismiss(notice: ShortcutNotice): void {
    this.notice.set(null);
    this.focusKey(notice.command);
  }

  protected formatKeyLabel(row: ShortcutRow, isRecording: boolean): string {
    return isRecording ? Resources.formatRecordingLabel(row.title, this.hint()) : Resources.formatChangeKeyLabel(row.title, row.key);
  }

  protected collisionId(row: ShortcutRow): string {
    return `${Resources.shortcutCollisionIdPrefix}${this.index}${Resources.shortcutIdSeparator}${row.name}`;
  }

  protected noticeId(row: ShortcutRow): string {
    return `${Resources.shortcutNoticeIdPrefix}${this.index}${Resources.shortcutIdSeparator}${row.name}`;
  }

  protected describeKey(row: ShortcutRow, hasNotice: boolean): string | null {
    const ids = [Object.isNull(row.collision) ? null : this.collisionId(row), hasNotice ? this.noticeId(row) : null].filter(t => !Object.isNull(t));
    return ids.length === 0 ? null : ids.join(Resources.idListSeparator);
  }

  private choose(command: string, event: KeyboardEvent): void {
    const shortcuts = this.commands.shortcuts();
    if (shortcuts.find(event) === command)
      return;
    const key = KeyChord.fromStroke(event, this.platform);
    if (Object.isNull(key)) {
      this.notice.set(new ShortcutNotice(command, this.unnamedKeyRefusal(event)));
      return;
    }
    const refusal = this.refusalOf(command, key);
    if (!Object.isNull(refusal)) {
      this.notice.set(new ShortcutNotice(command, refusal));
      return;
    }
    const holder = shortcuts.holderOf(key);
    if (Object.isUndefined(holder) || holder === command)
      this.write(this.bindings.with(command, key), command);
    else
      this.notice.set(new ShortcutNotice(command, Resources.formatKeyUsed(key.label(this.platform), this.commands.titleOf(holder)), key, holder));
  }

  private unnamedKeyRefusal(event: KeyboardEvent): string {
    if (!event.metaKey || this.platform === Resources.macPlatform)
      return Resources.unknownKeyRefused;
    return this.platform === Resources.windowsPlatform ? Resources.windowsKeyRefused : Resources.superKeyRefused;
  }

  private refusalOf(command: string, key: KeyChord): string | null {
    if (key.isTypingKey)
      return this.platform === Resources.macPlatform ? Resources.macTypingKeyRefused : Resources.typingKeyRefused;
    const owner = key.findReservedOwner(QualifiedName.parse(command));
    return Object.isNull(owner) ? null : Resources.formatKeyReserved(key.label(this.platform), owner);
  }

  private heldLabel(event: KeyboardEvent): string {
    const isMac = this.platform === Resources.macPlatform;
    const held = isMac
      ? Resources.macModifierSymbols.filter((_, index) => [event.ctrlKey, event.altKey, event.shiftKey, event.metaKey][index]).join(String.empty)
      : Resources.modifierNames.filter((_, index) => [event.ctrlKey, event.altKey, event.shiftKey][index]).map(t => `${t}${Resources.modifierSeparator}`).join(String.empty);
    return String.isNullOrEmpty(held) ? Resources.recordingHint : `${held}${Resources.recordingEllipsis}`;
  }

  private write(bindings: KeyBindings, command: string): void {
    this.notice.set(null);
    this.focusKey(command);
    this.track(bindings, this.settings.setAsync(Resources.keyBindingsSetting, bindings.toJson()));
  }

  private track(bindings: KeyBindings, request: Promise<void>): void {
    this.pending = bindings;
    request.then(() => this.settle(this.commands.bindings()), (error: unknown) => {
      if (this.pending === bindings)
        this.pending = null;
      this.errors.handleError(error);
    });
  }

  private settle(bindings: KeyBindings): void {
    if (this.pending?.isSameAs(bindings) === true)
      this.pending = null;
  }

  private focusKey(command: string): void {
    this.host.nativeElement.querySelector<HTMLElement>(Resources.formatShortcutKeySelector(command))?.focus();
  }
}
