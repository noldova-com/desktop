/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ErrorHandler, type Signal, computed, inject, input } from "@angular/core";

import { TooltipDirective } from "@noldova/ui.components.angular";
import type { JsonValue } from "@noldova/context.json";

import { StatusBarItemTone } from "../../enums/status-bar-item-tone.js";
import type { StatusBarItem } from "../../models/status-bar-item.js";
import type { StatusBarItemState } from "../../models/status-bar-item-state.js";
import { CommandService } from "../../services/command.service.js";

@Component({
  selector: "nol-status-bar-item",
  imports: [TooltipDirective],
  templateUrl: "./status-bar-item.component.html",
  styleUrl: "./status-bar-item.component.css",
  host: {
    "[attr.data-nol-item]": "item().name",
    "[class.nol-status-bar-item-hidden]": "state().isHidden",
    "[class.nol-status-bar-item-muted]": "isMuted()"
  }
})
export class StatusBarItemComponent {
  private readonly commands: CommandService = inject(CommandService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);

  protected readonly state: Signal<StatusBarItemState> = computed(() => this.item().state());
  protected readonly isMuted: Signal<boolean> = computed(() => this.state().tone === StatusBarItemTone.Muted);

  public readonly item = input.required<StatusBarItem>();

  protected isAvailable(command: string, commandArguments: JsonValue): boolean {
    return this.commands.isAvailable(command, commandArguments);
  }

  protected run(command: string, commandArguments: JsonValue): void {
    this.commands.runAsync(command, commandArguments).catch((error: unknown) => this.errors.handleError(error));
  }
}
