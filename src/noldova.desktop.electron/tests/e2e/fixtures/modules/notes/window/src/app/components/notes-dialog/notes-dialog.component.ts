/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DialogRef } from "@angular/cdk/dialog";
import { Component, inject } from "@angular/core";

import { ButtonComponent, DialogComponent } from "@noldova/ui.components.angular";

@Component({
  selector: "nol-notes-dialog",
  imports: [ButtonComponent, DialogComponent],
  templateUrl: "./notes-dialog.component.html"
})
export class NotesDialogComponent {
  protected readonly reference: DialogRef<unknown, NotesDialogComponent> = inject(DialogRef);
}
