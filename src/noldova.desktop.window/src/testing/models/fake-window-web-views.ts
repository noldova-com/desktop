/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Fake } from "@noldova/desktop.protocol/testing";

import type { IWindowWebViews } from "../../app/interfaces/i-window-web-views.js";

export class FakeWindowWebViews extends Fake<IWindowWebViews> implements IWindowWebViews {
  public readonly openAsync: IWindowWebViews["openAsync"] = (...args) => this.respondAsync("openAsync", args, this.answers.openAsync);
}
