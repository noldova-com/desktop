/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, type WritableSignal, computed, input, linkedSignal, output, untracked } from "@angular/core";

import "@noldova/context.core";
import { ButtonComponent, ButtonVariant, CheckboxComponent, ChoicePillsComponent, FieldMessageComponent, SelectComponent, SelectOption, TextFieldComponent, TooltipDirective } from "@noldova/ui.components.angular";
import type { JsonValue } from "@noldova/context.json";
import { type SettingDefinition, SettingKind, type SettingOption } from "@noldova/desktop.protocol";

import { Resources } from "../../../resources.js";
import { HighlightedTextComponent } from "../highlighted-text/highlighted-text.component.js";

@Component({
  selector: "nol-setting-row",
  imports: [ButtonComponent, CheckboxComponent, ChoicePillsComponent, FieldMessageComponent, HighlightedTextComponent, SelectComponent, TextFieldComponent, TooltipDirective],
  templateUrl: "./setting-row.component.html",
  styleUrl: "./setting-row.component.css",
  host: {
    "class": "nol-setting-row",
    "[attr.data-setting]": "definition().name.text",
    "[class.nol-setting-row-static]": "!hasControl()"
  }
})
export class SettingRowComponent {
  private static count: number = 0;

  private readonly index: number = SettingRowComponent.count++;

  protected readonly resources: typeof Resources = Resources;
  protected readonly errorId: string = `${Resources.settingErrorIdPrefix}${this.index}`;
  protected readonly descriptionId: string = `${Resources.settingDescriptionIdPrefix}${this.index}`;
  protected readonly noteId: string = `${Resources.settingNoteIdPrefix}${this.index}`;
  protected readonly kinds: typeof SettingKind = SettingKind;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly current: Signal<JsonValue> = computed(() => this.value() ?? this.definition().defaultValue);
  protected readonly error: WritableSignal<string | null> = linkedSignal<JsonValue, string | null>({ source: this.current, computation: () => null });
  protected readonly refusal: Signal<string | null> = computed(() => {
    const check = this.check();
    const value = this.current();
    return Object.isNull(check) ? null : untracked(() => check(this.asString(value)));
  });
  protected readonly entry: WritableSignal<readonly [text: string, message: string | null] | null> = linkedSignal<JsonValue, readonly [text: string, message: string | null] | null>({
    source: this.current,
    computation: (_current, previous) => {
      const entry = previous?.value ?? null;
      return Object.isNull(entry) || Object.isNull(entry[1]) ? null : entry;
    }
  });
  protected readonly fieldText: Signal<string> = computed(() => this.entry()?.[0] ?? this.asString(this.current()));
  protected readonly message: Signal<string | null> = computed(() => {
    const entry = this.entry();
    return this.error() ?? (Object.isNull(entry) ? this.refusal() : entry[1]);
  });
  protected readonly describedBy: Signal<string> = computed(() =>
    [this.descriptionId, ...Object.isNull(this.note()) ? [] : [this.noteId], ...Object.isNull(this.message()) ? [] : [this.errorId]].join(Resources.idListSeparator));
  protected readonly isWaiting: Signal<boolean> = computed(() => this.definition().type.isDynamic && Object.isNull(this.supplied()));
  protected readonly options: Signal<readonly SelectOption[]> = computed(() => {
    const type = this.definition().type;
    const supplied = this.supplied();
    if (!type.isDynamic)
      return type.options.map(t => new SelectOption(t.value, t.title));
    const current = this.asString(this.current());
    if (Object.isNull(supplied))
      return [new SelectOption(current, current.length === 0 ? Resources.emptyOptionValue : current)];
    const options = supplied.map(t => new SelectOption(t.value, t.title));
    return options.some(t => t.value === current) ? options : [new SelectOption(current, Resources.formatUnavailableOption(current)), ...options];
  });
  protected readonly hasControl: Signal<boolean> = computed(() => {
    const kind = this.definition().type.kind;
    const listed = kind === SettingKind.Modules ? this.modules() : kind === SettingKind.Languages ? this.languages() : null;
    return this.isSet() || (kind !== SettingKind.KeyBindings && (Object.isNull(listed) || listed.length > 0));
  });
  protected readonly isFew: Signal<boolean> = computed(() => this.options().length >= Resources.choicePillMinimum && this.options().length <= Resources.choicePillLimit);
  protected readonly chosen: Signal<ReadonlySet<string>> = computed(() => {
    const value = this.current();
    return new Set(Array.isArray(value) ? value.filter((t): t is string => Object.isString(t)) : []);
  });

  public readonly definition = input.required<SettingDefinition>();
  public readonly value = input<JsonValue | undefined>(undefined);
  public readonly isSet = input<boolean>(false);
  public readonly query = input<string>(String.empty);
  public readonly modules = input<readonly SelectOption[]>([]);
  public readonly languages = input<readonly SelectOption[]>([]);
  public readonly note = input<string | null>(null);
  public readonly isRequired = input<boolean>(false);
  public readonly isInverse = input<boolean>(false);
  public readonly canRun = input<boolean>(false);
  public readonly supplied = input<readonly SettingOption[] | null>(null);
  public readonly check = input<((value: string) => string | null) | null>(null);
  public readonly changed = output<JsonValue>();
  public readonly drafted = output<string>();
  public readonly reset = output<void>();
  public readonly run = output<void>();

  protected choose(value: JsonValue): void {
    this.error.set(null);
    this.changed.emit(value);
  }

  protected commitNumber(event: Event): void {
    if (!(event.target instanceof HTMLInputElement))
      return;
    const value = event.target.valueAsNumber;
    const type = this.definition().type;
    if (!Number.isNaN(value) && type.accepts(value)) {
      this.choose(value);
      return;
    }
    this.error.set(Resources.formatNumberRange(type.minimum, type.maximum, type.step));
  }

  protected revertNumber(event: Event): void {
    if (!(event.target instanceof HTMLInputElement))
      return;
    if (Object.isNull(this.error()) && event.target.valueAsNumber === this.current())
      return;
    event.stopPropagation();
    event.target.value = String(this.current());
    this.error.set(null);
  }

  protected draftText(event: Event): void {
    if (event.target instanceof HTMLInputElement)
      this.drafted.emit(event.target.value);
  }

  protected commitText(event: Event): void {
    if (!(event.target instanceof HTMLInputElement))
      return;
    const value = event.target.value;
    if (this.isRequired() && String.isNullOrWhitespace(value)) {
      event.target.value = this.asString(this.definition().defaultValue);
      this.entry.set(null);
      this.reset.emit();
      return;
    }
    const refused = this.check()?.(value) ?? null;
    this.entry.set([value, refused]);
    if (Object.isNull(refused))
      this.choose(value);
  }

  protected toggleModule(id: string, isChecked: boolean): void {
    const isChosen = isChecked !== this.isInverse();
    const chosen = new Set(this.chosen());
    if (isChosen)
      chosen.add(id);
    else
      chosen.delete(id);
    this.choose(this.modules().map(t => t.value).filter(t => chosen.has(t)));
  }

  protected toggleLanguage(tag: string, isChecked: boolean): void {
    const chosen = new Set(this.chosen());
    if (isChecked)
      chosen.add(tag);
    else
      chosen.delete(tag);
    this.choose(this.languages().map(t => t.value).filter(t => chosen.has(t)));
  }

  protected asString(value: JsonValue): string {
    return String(value);
  }
}
