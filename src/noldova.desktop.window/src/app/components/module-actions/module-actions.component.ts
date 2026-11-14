/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Component,
  DestroyRef,
  ErrorHandler,
  type InputSignal,
  type WritableSignal,
  inject,
  input,
  signal
} from "@angular/core";

import "@noldova/context.core";
import { ButtonComponent, ButtonVariant } from "@noldova/ui.components.angular";
import type { ModuleStatus } from "@noldova/desktop.protocol";

import { DetailsService } from "../../services/details.service.js";
import { PreloadBridgeService } from "../../services/preload-bridge.service.js";
import { Resources } from "../../../resources.js";

@Component({
  selector: "nol-module-actions",
  imports: [ButtonComponent],
  templateUrl: "./module-actions.component.html",
  styleUrl: "./module-actions.component.css",
  host: {
    "class": "nol-module-actions"
  }
})
export class ModuleActionsComponent {
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);
  private readonly details: DetailsService = inject(DetailsService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly isCopied: WritableSignal<boolean> = signal(false);
  protected readonly isLogFolderFailed: WritableSignal<boolean> = signal(false);

  public readonly module: InputSignal<ModuleStatus> = input.required<ModuleStatus>();

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.clearCopiedTimer());
  }

  protected copy(): void {
    this.copyAsync().catch((error: unknown) => this.errors.handleError(error));
  }

  protected openLogFolder(): void {
    this.bridge.openLogFolderAsync().then(
      t => this.isLogFolderFailed.set(!t),
      (error: unknown) => {
        this.isLogFolderFailed.set(true);
        this.errors.handleError(error);
      });
  }

  private async copyAsync(): Promise<void> {
    if (!await this.details.copyAsync([this.module()]))
      return;
    this.clearCopiedTimer();
    this.isCopied.set(true);
    this.copiedTimer = setTimeout(() => {
      this.copiedTimer = null;
      this.isCopied.set(false);
    }, Resources.copiedDuration);
  }

  private clearCopiedTimer(): void {
    if (!Object.isNull(this.copiedTimer))
      clearTimeout(this.copiedTimer);
    this.copiedTimer = null;
  }
}
