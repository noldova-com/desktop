/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DialogRef } from "@angular/cdk/dialog";
import { Injectable, type Signal, type WritableSignal, inject, signal } from "@angular/core";

import "@noldova/context.core";
import { DialogService } from "@noldova/ui.components.angular";

import { QuitDialogComponent } from "../components/quit-dialog/quit-dialog.component.js";
import type { QuitChoice } from "../enums/quit-choice.js";
import type { QuitQuestion } from "../models/quit-question.js";
import { PreloadBridgeService } from "./preload-bridge.service.js";
import { Resources } from "../../resources.js";

@Injectable({ providedIn: "root" })
export class QuitService {
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly questionValue: WritableSignal<QuitQuestion | null> = signal(null);
  private dialog: DialogRef<unknown, QuitDialogComponent> | null = null;

  public readonly question: Signal<QuitQuestion | null> = this.questionValue.asReadonly();

  public listen(): () => void {
    return this.bridge.onQuitQuestion(t => this.show(t));
  }

  public answer(choice: QuitChoice): void {
    void this.bridge.answerQuitAsync(choice);
  }

  private show(question: QuitQuestion | null): void {
    this.questionValue.set(question);
    if (Object.isNull(question)) {
      this.dialog?.close();
      this.dialog = null;
    }
    else if (Object.isNull(this.dialog))
      this.dialog = this.dialogs.open(QuitDialogComponent, Resources.waitFocusSelector);
  }
}
