/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, DOCUMENT, ElementRef, ErrorHandler, PendingTasks, type Signal, type WritableSignal, computed, effect, inject, signal, untracked,
  viewChild } from "@angular/core";

import "@noldova/context.core";
import { AppearanceService, ButtonComponent, ButtonVariant, ProgressComponent, ThemeMode } from "@noldova/ui.components.angular";

import { UpdateAction } from "../../enums/update-action.js";
import { UpdateStateKind } from "../../enums/update-state-kind.js";
import type { IProductAbout } from "../../interfaces/i-product-about.js";
import { BuildTokens } from "../../models/build-tokens.js";
import type { UpdateState } from "../../models/update-state.js";
import { PreloadBridgeService } from "../../services/preload-bridge.service.js";
import { UpdateService } from "../../services/update.service.js";
import { ProductName } from "../../models/product-name.js";
import { Resources } from "../../../resources.js";

@Component({
  selector: "nol-about",
  imports: [ButtonComponent, ProgressComponent],
  templateUrl: "./about.component.html",
  styleUrl: "./about.component.css",
  host: {
    "class": "nol-settings-group",
    "role": "region",
    "[attr.aria-label]": "resources.formatAboutLabel(productName)"
  }
})
export class AboutComponent {
  private readonly updates: UpdateService = inject(UpdateService);
  private readonly time: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, Resources.timeFormat);
  private readonly dayAndTime: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, Resources.dayAndTimeFormat);
  private readonly statusElement: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("statusLine");
  private readonly document: Document = inject(DOCUMENT);
  private readonly appearance: AppearanceService = inject(AppearanceService);
  private shownKind: UpdateStateKind | null = null;

  protected readonly resources: typeof Resources = Resources;
  protected readonly productName: string = ProductName.current;
  protected readonly kinds: typeof UpdateStateKind = UpdateStateKind;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly version: WritableSignal<string> = signal(ProductName.current);
  protected readonly platform: string;
  protected readonly about: IProductAbout = inject(BuildTokens.about);
  protected readonly logo: Signal<string | null> = computed(() => {
    const logo = this.about.logo;
    return Object.isNull(logo) ? null : this.appearance.mode() === ThemeMode.Dark ? logo.dark : logo.light;
  });
  protected readonly websiteLabel: string | null = Object.isNull(this.about.website) ? null : AboutComponent.hostOf(this.about.website);
  protected readonly state: Signal<UpdateState> = this.updates.state;
  protected readonly status: Signal<string> = computed(() => this.statusOf(this.state()));
  protected readonly percent: Signal<string | null> = computed(() => {
    const state = this.state();
    return state.kind !== UpdateStateKind.Downloading || Object.isNull(state.progress) ? null : Resources.formatDownloadPercent(state.progress);
  });
  protected readonly details: Signal<readonly string[]> = computed(() => this.detailsOf(this.state()));
  protected readonly showsMoveHint: Signal<boolean> = computed(() => this.state().kind === UpdateStateKind.Failed && this.state().mustMove);
  protected readonly progressLabel: Signal<string> = computed(() => Resources.formatDownloadingVersion(ProductName.current, this.state().version));
  protected readonly share: Signal<number | null> = computed(() => {
    const progress = this.state().progress;
    return Object.isNull(progress) ? null : progress / Resources.maximumProgress;
  });

  public constructor() {
    const bridge = inject(PreloadBridgeService);
    const errors = inject(ErrorHandler);
    this.platform = Resources.formatPlatform(bridge.platform, bridge.processor);
    void inject(PendingTasks).run(() =>
      bridge.readBuildAsync().then(t => this.version.set(Resources.formatProductVersion(ProductName.current, t.productVersion)), (error: unknown) => errors.handleError(error)));
    effect(() => {
      const kind = this.state().kind;
      if (kind !== this.shownKind)
        untracked(() => this.keepFocus());
      this.shownKind = kind;
    });
  }

  protected check(): void {
    this.updates.act(UpdateAction.Check);
  }

  protected restart(): void {
    this.updates.act(UpdateAction.Restart);
  }

  private static hostOf(address: string): string {
    return URL.canParse(address) ? new URL(address).host : address;
  }

  private statusOf(state: UpdateState): string {
    switch (state.kind) {
      case UpdateStateKind.Off:
        return Resources.updatesOff;
      case UpdateStateKind.UpToDate:
        return Resources.formatUpToDate(ProductName.current);
      case UpdateStateKind.Checking:
        return Resources.checkingForUpdates;
      case UpdateStateKind.Available:
        return Resources.formatMoveToApplications(ProductName.current);
      case UpdateStateKind.Downloading:
        return Resources.formatDownloadingLine(ProductName.current, state.version);
      case UpdateStateKind.Ready:
        return Resources.formatUpdateReady(ProductName.current, state.version);
      case UpdateStateKind.Failed:
        return Resources.updateFailed;
    }
  }

  private detailsOf(state: UpdateState): readonly string[] {
    if (state.kind === UpdateStateKind.UpToDate && !Object.isNull(state.checkedAt))
      return [Resources.formatLastChecked(this.formatChecked(state.checkedAt))];
    return [UpdateStateKind.Ready, UpdateStateKind.Failed].includes(state.kind) && !Object.isNull(state.reason) ? [state.reason] : [];
  }

  private formatChecked(checkedAt: number): string {
    return new Date(checkedAt).toDateString() === new Date().toDateString() ? this.time.format(checkedAt) : this.dayAndTime.format(checkedAt);
  }

  private keepFocus(): void {
    const status = this.statusElement().nativeElement;
    const focused = this.document.activeElement;
    if (focused instanceof HTMLButtonElement && focused.parentElement === status.parentElement)
      status.focus();
  }
}
