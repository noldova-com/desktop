/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, inject } from "@angular/core";

import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";

@Component({
  selector: "nol-notes-welcome",
  templateUrl: "./notes-welcome.component.html"
})
export class NotesWelcomeComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);

  protected newNote(): void {
    void this.context.runCommandAsync("notes.newNote", null);
  }
}
