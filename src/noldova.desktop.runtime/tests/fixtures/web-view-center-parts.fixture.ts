/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WebViewCenter } from "@noldova/desktop.runtime";

import type { EventSinkFixture } from "./event-sink.fixture.js";
import type { TextOutputFixture } from "./text-output.fixture.js";

export class WebViewCenterPartsFixture {
  public readonly center: WebViewCenter;
  public readonly sink: EventSinkFixture;
  public readonly diagnostics: TextOutputFixture;

  public constructor(center: WebViewCenter, sink: EventSinkFixture, diagnostics: TextOutputFixture) {
    this.center = center;
    this.sink = sink;
    this.diagnostics = diagnostics;
  }
}
