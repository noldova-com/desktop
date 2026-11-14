/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import {
  Component,
  DestroyRef,
  ElementRef,
  ErrorHandler,
  Injector,
  PendingTasks,
  type Signal,
  type WritableSignal,
  afterNextRender,
  computed,
  effect,
  inject,
  signal
} from "@angular/core";

import "@noldova/context.core";
import { GroupHeaderComponent, IconButtonComponent, TooltipDirective } from "@noldova/ui.components.angular";
import { ModuleState, type ModuleStatus } from "@noldova/desktop.protocol";

import type { ContributionGroup } from "../../models/modules/contribution-group.js";
import { ModuleOverview } from "../../models/modules/module-overview.js";
import { ProgramRow } from "../../models/modules/program-row.js";
import { ProductName } from "../../models/product-name.js";
import { WindowPartTokens } from "../../models/window-part-tokens.js";
import { CommandService } from "../../services/command.service.js";
import { PreloadBridgeService } from "../../services/preload-bridge.service.js";
import { ModuleSelectionService } from "../../services/module-selection.service.js";
import { ModuleStatusService } from "../../services/module-status.service.js";
import { ProgramStatusService } from "../../services/program-status.service.js";
import { SettingsService } from "../../services/settings.service.js";
import { Resources } from "../../../resources.js";
import { ModuleActionsComponent } from "../module-actions/module-actions.component.js";
import { ModuleSwitchComponent } from "../module-switch/module-switch.component.js";

@Component({
  selector: "nol-modules",
  imports: [GroupHeaderComponent, IconButtonComponent, ModuleActionsComponent, ModuleSwitchComponent, NgTemplateOutlet, TooltipDirective],
  templateUrl: "./modules.component.html",
  styleUrl: "./modules.component.css",
  host: {
    "class": "nol-modules"
  }
})
export class ModulesComponent {
  private readonly commands: CommandService = inject(CommandService);
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly element: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector: Injector = inject(Injector);
  private readonly modules: Signal<readonly ModuleStatus[]> = inject(ModuleStatusService).modules;
  private readonly selection: ModuleSelectionService = inject(ModuleSelectionService);
  private readonly programs: ProgramStatusService = inject(ProgramStatusService);
  private readonly isShown: Signal<boolean> = inject(WindowPartTokens.shown);
  private readonly time: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, Resources.programStartFormat);
  private readonly now: WritableSignal<number> = signal(Date.now());
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly openGroups: WritableSignal<ReadonlySet<string>> = signal(new Set<string>());
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly resources: typeof Resources = Resources;
  protected readonly active: ModuleState = ModuleState.Active;
  protected readonly off: ModuleState = ModuleState.Off;
  protected readonly unavailable: ModuleState = ModuleState.Unavailable;
  protected readonly version: WritableSignal<string | null> = signal(null);
  protected readonly overview: Signal<ModuleOverview> = computed(() => new ModuleOverview(this.modules()));
  protected readonly current: Signal<ModuleStatus | null> = computed(() => this.overview().select(this.selection.selected()));
  protected readonly copiedProcess: WritableSignal<number | null> = signal(null);

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.clearCopiedTimer());
    effect(onCleanup => {
      if (!this.isShown())
        return;
      this.now.set(Date.now());
      const clock = setInterval(() => this.now.set(Date.now()), Resources.minuteDuration);
      onCleanup(() => clearInterval(clock));
    });
    void inject(PendingTasks).run(() =>
      this.bridge.readBuildAsync().then(t => this.version.set(Resources.formatProductVersion(ProductName.current, t.productVersion)), (error: unknown) => this.errors.handleError(error)));
  }

  protected labelOf(state: ModuleState): string {
    return Resources.moduleStateLabels[state];
  }

  protected select(id: string): void {
    this.selection.select(id);
  }

  protected follow(id: string): void {
    this.selection.select(id);
    afterNextRender(() => [...this.element.querySelectorAll<HTMLElement>(Resources.moduleSelector)].find(t => t.dataset[Resources.moduleData] === id)?.focus(),
      { injector: this.injector });
  }

  protected contributionsOf(module: ModuleStatus): readonly ContributionGroup[] {
    return ModuleOverview.listContributions(module, (kind, name) => this.titleOf(kind, name));
  }

  protected programsOf(module: ModuleStatus): readonly ProgramRow[] {
    const now = this.now();
    return this.programs.ofModule(module.id).map(t => ProgramRow.from(t, now, this.time));
  }

  protected isOpen(module: ModuleStatus, kind: string): boolean {
    return this.openGroups().has(ModulesComponent.groupKey(module, kind));
  }

  protected setOpen(module: ModuleStatus, kind: string, isOpen: boolean): void {
    const key = ModulesComponent.groupKey(module, kind);
    this.openGroups.update(t => new Set(isOpen ? [...t, key] : [...t].filter(u => u !== key)));
  }

  protected copyPath(program: ProgramRow): void {
    this.copyPathAsync(program).catch((error: unknown) => this.errors.handleError(error));
  }

  protected countOf(module: ModuleStatus): string | null {
    const count = this.programs.ofModule(module.id).length;
    return count > 0 ? Resources.formatProgramCount(count) : null;
  }

  private static groupKey(module: ModuleStatus, kind: string): string {
    return `${module.id}${Resources.contributionSeparator}${kind}`;
  }

  private async copyPathAsync(program: ProgramRow): Promise<void> {
    if (!await this.bridge.writeTextAsync(program.path))
      return;
    this.clearCopiedTimer();
    this.copiedProcess.set(program.processId);
    this.copiedTimer = setTimeout(() => {
      this.copiedTimer = null;
      this.copiedProcess.set(null);
    }, Resources.copiedDuration);
  }

  private clearCopiedTimer(): void {
    if (!Object.isNull(this.copiedTimer))
      clearTimeout(this.copiedTimer);
    this.copiedTimer = null;
  }

  private titleOf(kind: string, name: string): string | null {
    if (kind === Resources.commandsKind)
      return this.commands.commands().find(t => t.name === name)?.title ?? null;
    if (kind === Resources.settingsKind)
      return this.settings.definitions().find(t => t.name.text === name)?.title ?? null;
    return null;
  }
}
