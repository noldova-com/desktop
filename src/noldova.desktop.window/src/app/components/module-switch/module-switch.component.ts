/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ErrorHandler, type InputSignal, PendingTasks, type Signal, type WritableSignal, computed, inject, input, signal } from "@angular/core";

import { CheckboxComponent } from "@noldova/ui.components.angular";

import { ModuleSwitchService } from "../../services/module-switch.service.js";
import { SettingsService } from "../../services/settings.service.js";

@Component({
  selector: "nol-module-switch",
  imports: [CheckboxComponent],
  templateUrl: "./module-switch.component.html"
})
export class ModuleSwitchComponent {
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly switches: ModuleSwitchService = inject(ModuleSwitchService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly pending: WritableSignal<{ readonly isOn: boolean } | null> = signal(null);

  protected readonly isOn: Signal<boolean> = computed(() => this.pending()?.isOn ?? this.settings.values().get(this.setting()) !== false);
  protected readonly label: Signal<string> = computed(() => this.settings.definitions().find(t => t.name.text === this.setting())?.description ?? this.setting());

  public readonly setting: InputSignal<string> = input.required<string>();

  protected turn(isOn: boolean): void {
    const change = { isOn };
    this.pending.set(change);
    void this.tasks.run(() => this.switches.setAsync(this.setting(), isOn)
      .catch((error: unknown) => this.errors.handleError(error))
      .finally(() => this.pending.update(t => t === change ? null : t)));
  }
}
