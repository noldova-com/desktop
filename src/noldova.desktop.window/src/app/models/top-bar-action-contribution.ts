/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { QualifiedName } from "@noldova/desktop.protocol";

import { TopBarSide } from "../enums/top-bar-side.js";
import type { TopBarActionState } from "./top-bar-action-state.js";
import { Resources } from "../../resources.js";

export class TopBarActionContribution {
  public readonly name: string;
  public readonly state: TopBarActionState;
  public readonly side: TopBarSide;

  public constructor(name: string, state: TopBarActionState, side: TopBarSide = TopBarSide.End) {
    this.name = QualifiedName.parse(name, Resources.nameParameter).text;
    this.state = state;
    this.side = side;
  }
}
