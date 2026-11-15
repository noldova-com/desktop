/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";

import { PageComponent } from "../page/page.component";

@Component({
  selector: "nol-pages-side",
  templateUrl: "../page/page.component.html",
  styleUrl: "../page/page.component.css"
})
export class SideComponent extends PageComponent {
  protected override readonly paneName: string = "pages.side";
}
