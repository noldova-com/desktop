/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";

import { ViewToolbarBandComponent } from "@noldova/desktop.window";

@Component({
  selector: "nol-notes-board",
  imports: [ViewToolbarBandComponent],
  templateUrl: "./notes-board.component.html"
})
export class NotesBoardComponent {
}
