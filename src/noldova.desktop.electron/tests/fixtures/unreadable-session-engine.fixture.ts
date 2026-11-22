/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWebViewEngine } from "./fake-web-view-engine.fixture.js";
import type { FakeWebViewSession } from "./fake-web-view-session.fixture.js";

export class UnreadableSessionEngineFixture extends FakeWebViewEngine {
  public static readonly MESSAGE: string = "The engine has no sessions.";

  public override readSession(_partition: string): FakeWebViewSession {
    throw new RangeError(UnreadableSessionEngineFixture.MESSAGE);
  }
}
