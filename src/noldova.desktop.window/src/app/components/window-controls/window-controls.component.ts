/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, DestroyRef, ErrorHandler, PendingTasks, type Signal, type WritableSignal, inject, signal } from "@angular/core";

import { OverlaySide, TooltipDirective } from "@noldova/ui.components.angular";
import { WindowAction } from "@noldova/desktop.protocol";

import { Resources } from "../../../resources.js";
import { PreloadBridgeService } from "../../services/preload-bridge.service.js";

@Component({
  selector: "nol-window-controls",
  imports: [TooltipDirective],
  templateUrl: "./window-controls.component.html",
  styleUrl: "./window-controls.component.css",
  host: {
    role: "group",
    "[attr.aria-label]": "resources.windowControlsLabel"
  }
})
export class WindowControlsComponent {
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly maximizedValue: WritableSignal<boolean> = signal(false);
  private hasMaximizedEvent: boolean = false;

  protected readonly resources: typeof Resources = Resources;
  protected readonly below: OverlaySide = OverlaySide.below;
  protected readonly isMaximized: Signal<boolean> = this.maximizedValue.asReadonly();

  public constructor() {
    inject(DestroyRef).onDestroy(this.bridge.onMaximized(t => {
      this.hasMaximizedEvent = true;
      this.maximizedValue.set(t);
    }));
    void inject(PendingTasks).run(() => this.bridge.readMaximizedAsync().then(t => {
      if (!this.hasMaximizedEvent)
        this.maximizedValue.set(t);
    }, (error: unknown) => this.errors.handleError(error)));
  }

  protected minimize(): void {
    this.act(WindowAction.Minimize);
  }

  protected toggleMaximized(): void {
    this.act(WindowAction.ToggleMaximized);
  }

  protected close(): void {
    this.act(WindowAction.Close);
  }

  private act(action: WindowAction): void {
    this.bridge.actOnWindowAsync(action).catch((error: unknown) => this.errors.handleError(error));
  }
}
