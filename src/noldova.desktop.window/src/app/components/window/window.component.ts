/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Dialog } from "@angular/cdk/dialog";
import { CdkConnectedOverlay, CdkOverlayOrigin, type OverlayRef } from "@angular/cdk/overlay";
import { Component, DestroyRef, ElementRef, Injector, type Signal, type WritableSignal, afterNextRender, afterRenderEffect, effect, inject, signal, untracked, viewChild } from "@angular/core";

import { AppearanceService } from "@noldova/ui.components.angular";

import { AppearanceSettingsService } from "../../services/appearance-settings.service.js";
import { SpellingService } from "../../services/spelling.service.js";
import { ClosingService } from "../../services/closing.service.js";
import { DialogCoverService } from "../../services/dialog-cover.service.js";
import { PreloadBridgeService } from "../../services/preload-bridge.service.js";
import { LinkService } from "../../services/link.service.js";
import { QuitService } from "../../services/quit.service.js";
import { RecentCommandsService } from "../../services/recent-commands.service.js";
import { StartupService } from "../../services/startup.service.js";
import { WindowPartHostService } from "../../services/window-part-host.service.js";
import { FieldMenuComponent } from "../field-menu/field-menu.component.js";
import { LinkMenuComponent } from "../link-menu/link-menu.component.js";
import { StartupComponent } from "../startup/startup.component.js";
import { StatusBarComponent } from "../status-bar/status-bar.component.js";
import { ToolbarBandComponent } from "../toolbar-band/toolbar-band.component.js";
import { ToastsComponent } from "../toasts/toasts.component.js";
import { WindowRowComponent } from "../window-row/window-row.component.js";
import { WorkspaceComponent } from "../workspace/workspace.component.js";
import { Resources } from "../../../resources.js";

@Component({
  selector: "nol-window",
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, FieldMenuComponent, LinkMenuComponent, StartupComponent, StatusBarComponent, ToastsComponent, ToolbarBandComponent, WindowRowComponent, WorkspaceComponent],
  templateUrl: "./window.component.html",
  styleUrl: "./window.component.css"
})
export class WindowComponent {
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);
  private readonly closing: ClosingService = inject(ClosingService);

  private readonly injector: Injector = inject(Injector);
  private readonly origin: Signal<ElementRef<HTMLElement> | undefined> = viewChild(CdkOverlayOrigin, { read: ElementRef });
  private readonly coverSizeValue: WritableSignal<{ readonly width: number; readonly height: number }> = signal({ width: 0, height: 0 });
  private coverReference: OverlayRef | null = null;
  private openedFocus: Element | null = null;

  protected readonly resources: typeof Resources = Resources;
  protected readonly startup: StartupService = inject(StartupService);
  protected readonly cover: DialogCoverService = inject(DialogCoverService);
  protected readonly coverSize: Signal<{ readonly width: number; readonly height: number }> = this.coverSizeValue.asReadonly();

  public constructor() {
    inject(AppearanceService);
    inject(AppearanceSettingsService);
    inject(SpellingService);
    inject(WindowPartHostService);
    inject(RecentCommandsService);
    const destroyed = inject(DestroyRef);
    destroyed.onDestroy(this.bridge.onCloseRequest(t => void this.closeAsync(t)));
    destroyed.onDestroy(this.bridge.onUpdateSaveRequest(t => void this.saveForUpdateAsync(t)));
    destroyed.onDestroy(inject(QuitService).listen());
    destroyed.onDestroy(inject(LinkService).listen());
    const opened = inject(Dialog).afterOpened.subscribe(() => {
      this.openedFocus = document.activeElement;
    });
    destroyed.onDestroy(() => opened.unsubscribe());
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const box = entry.target.getBoundingClientRect();
        this.coverSizeValue.set({ width: box.width, height: box.height });
      }
      this.coverReference?.updatePosition();
    });
    destroyed.onDestroy(() => observer.disconnect());
    afterRenderEffect(() => {
      const origin = this.origin();
      observer.disconnect();
      if (!Object.isUndefined(origin))
        observer.observe(origin.nativeElement);
    });
    effect(() => {
      this.cover.isCovering();
      untracked(() => this.keepCardFocus());
    });
  }

  protected attachCover(reference: OverlayRef): void {
    this.coverReference = reference;
    this.cover.attach(reference.hostElement);
  }

  protected detachCover(): void {
    this.coverReference = null;
    this.cover.detach();
  }

  private keepCardFocus(): void {
    const focused = document.activeElement === document.body ? this.openedFocus : document.activeElement;
    this.openedFocus = null;
    const index = [...document.querySelectorAll<HTMLElement>(Resources.reconnectingButtonSelector)].findIndex(t => t === focused);
    if (index >= 0)
      afterNextRender(() => [...document.querySelectorAll<HTMLElement>(Resources.reconnectingButtonSelector)].at(index)?.focus({ preventScroll: true }), { injector: this.injector });
  }

  private async closeAsync(requestId: string): Promise<void> {
    await this.bridge.answerCloseAsync(requestId, await this.closing.saveAsync());
  }

  private async saveForUpdateAsync(requestId: string): Promise<void> {
    await this.bridge.answerUpdateSaveAsync(requestId, await this.closing.saveForUpdateAsync());
  }
}
