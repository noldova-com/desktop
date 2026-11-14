/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, DestroyRef, ElementRef, type InputSignal, type Signal, type WritableSignal, computed, effect, inject, input, signal,
  untracked } from "@angular/core";

import "@noldova/context.core";
import { QualifiedName } from "@noldova/desktop.protocol";
import { ButtonComponent, ButtonVariant, TooltipDirective } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.js";
import type { Tab } from "../../models/layout/tab.js";
import { AgentControlService } from "../../services/agent-control.service.js";
import { CommandService } from "../../services/command.service.js";
import { LiveViewService } from "../../services/live-view.service.js";
import { ModuleStatusService } from "../../services/module-status.service.js";
import type { TabContentComponent } from "../tab-content/tab-content.component.js";

@Component({
  selector: "nol-tab-slot",
  templateUrl: "./tab-slot.component.html",
  styleUrl: "./tab-slot.component.css",
  imports: [ButtonComponent, TooltipDirective],
  host: {
    "[class.nol-tab-slot-docked]": "isDocked()"
  }
})
export class TabSlotComponent {
  private readonly views: LiveViewService = inject(LiveViewService);
  private readonly element: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly contentValue: WritableSignal<TabContentComponent | null> = signal(null);
  private readonly agentControl: AgentControlService = inject(AgentControlService);
  private readonly modules: ModuleStatusService = inject(ModuleStatusService);
  private readonly commands: CommandService = inject(CommandService);
  private shown: Tab | null = null;

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly isStopped: Signal<boolean> = computed(() => {
    const owner = QualifiedName.find(this.tab().name)?.owner;
    return this.agentControl.state()?.isStopped === true && !Object.isUndefined(owner) && this.modules.offeringTools().includes(owner);
  });

  public readonly tab: InputSignal<Tab> = input.required<Tab>();
  public readonly isDocked: InputSignal<boolean> = input<boolean>(false);
  public readonly content: Signal<TabContentComponent | null> = this.contentValue.asReadonly();

  public constructor() {
    effect(() => {
      const tab = this.tab();
      const isDocked = this.isDocked();
      this.views.destroyed();
      untracked(() => this.show(tab, isDocked));
    });
    inject(DestroyRef).onDestroy(() => this.hide());
  }

  protected resume(): void {
    this.commands.run(Resources.resumeAgentControlCommand);
  }

  private show(tab: Tab, isDocked: boolean): void {
    if (!Object.isNull(this.shown) && !this.shown.equals(tab))
      this.views.hide(this.shown, this.element);
    this.shown = tab;
    this.contentValue.set(this.views.show(tab, this.element, isDocked));
  }

  private hide(): void {
    if (!Object.isNull(this.shown))
      this.views.hide(this.shown, this.element);
  }
}
