/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IFrameNavigation, IWebViewFrame } from "@noldova/desktop.electron";

import { FakePreventableEvent } from "./fake-preventable-event.fixture.js";

export class FakeFrameNavigation extends FakePreventableEvent implements IFrameNavigation {
  public readonly url: string;
  public readonly isMainFrame: boolean;
  public readonly frame: IWebViewFrame | null;
  public readonly initiator: IWebViewFrame | null;

  public constructor(url: string, isMainFrame: boolean, frame: IWebViewFrame | null = null, initiator: IWebViewFrame | null = frame) {
    super();
    this.url = url;
    this.isMainFrame = isMainFrame;
    this.frame = frame;
    this.initiator = initiator;
  }
}
