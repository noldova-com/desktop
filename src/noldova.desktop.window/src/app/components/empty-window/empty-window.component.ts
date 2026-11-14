/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";

import { ProductName } from "../../models/product-name.js";
import { Resources } from "../../../resources.js";

@Component({
  selector: "nol-empty-window",
  templateUrl: "./empty-window.component.html",
  styleUrl: "./empty-window.component.css"
})
export class EmptyWindowComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly productName: string = ProductName.current;
}
