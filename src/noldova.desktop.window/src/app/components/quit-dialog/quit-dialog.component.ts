/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ElementRef, afterRenderEffect, inject, viewChild } from "@angular/core";

import { ButtonComponent, ButtonVariant, DialogComponent } from "@noldova/ui.components.angular";

import { QuitChoice } from "../../enums/quit-choice.js";
import { QuitService } from "../../services/quit.service.js";
import { ProductName } from "../../models/product-name.js";
import { Resources } from "../../../resources.js";

@Component({
  selector: "nol-quit-dialog",
  imports: [DialogComponent, ButtonComponent],
  templateUrl: "./quit-dialog.component.html",
  styleUrl: "./quit-dialog.component.css"
})
export class QuitDialogComponent {
  private readonly cancel = viewChild.required(Resources.cancelReference, { read: ElementRef<HTMLButtonElement> });
  private wasWaiting: boolean = false;

  protected readonly resources: typeof Resources = Resources;
  protected readonly productName: string = ProductName.current;
  protected readonly choices: typeof QuitChoice = QuitChoice;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly quit: QuitService = inject(QuitService);

  public constructor() {
    afterRenderEffect(() => {
      const isWaiting = this.quit.question()?.isWaiting === true;
      if (isWaiting && !this.wasWaiting)
        this.cancel().nativeElement.focus();
      this.wasWaiting = isWaiting;
    });
  }
}
