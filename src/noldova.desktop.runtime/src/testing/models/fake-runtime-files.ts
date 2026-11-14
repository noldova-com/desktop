/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Fake } from "@noldova/desktop.protocol/testing";

import type { IRuntimeFiles } from "../../interfaces/i-runtime-files.js";

export class FakeRuntimeFiles extends Fake<IRuntimeFiles> implements IRuntimeFiles {
  public readonly redeemAsync: IRuntimeFiles["redeemAsync"] = (...args) => this.respondAsync("redeemAsync", args, this.answers.redeemAsync);
  public readonly shareAsync: IRuntimeFiles["shareAsync"] = (...args) => this.respondAsync("shareAsync", args, this.answers.shareAsync);
}
