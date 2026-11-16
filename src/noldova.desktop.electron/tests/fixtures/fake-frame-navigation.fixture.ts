/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IFrameNavigation } from "@noldova/desktop.electron";

import { FakePreventableEvent } from "./fake-preventable-event.fixture.js";

export class FakeFrameNavigation extends FakePreventableEvent implements IFrameNavigation {
  public readonly url: string;
  public readonly isMainFrame: boolean;

  public constructor(url: string, isMainFrame: boolean) {
    super();
    this.url = url;
    this.isMainFrame = isMainFrame;
  }
}
