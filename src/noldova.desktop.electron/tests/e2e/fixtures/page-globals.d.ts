/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPageBridge } from "./page-bridge.fixture.ts";

export interface IReconnectRecord {
  readonly workspace: Element | null;
  wasInert: boolean;
  card: string;
}

export interface IKeptRecord {
  readonly note: Element | null;
  readonly clock: Element | null;
}

export interface IStartupRecord {
  readonly kind: string;
  readonly at: number;
}

export interface ICoveringRecord {
  wasInert: boolean;
  wasCovered: boolean;
}

export interface IInertRecord {
  wasInert: boolean;
}

export interface IWindowControlsOverlay {
  readonly visible: boolean;
  getTitlebarAreaRect(): DOMRect;
}

declare global {
  interface Navigator {
    readonly windowControlsOverlay?: IWindowControlsOverlay;
  }

  var desktop: IPageBridge | undefined;
  var startups: string[] | undefined;
  var startupRecords: IStartupRecord[] | undefined;
  var reconnecting: IReconnectRecord | undefined;
  var kept: IKeptRecord | undefined;
  var covering: ICoveringRecord | undefined;
  var clock: Element | null | undefined;
  var liveMarks: Map<string, Element> | undefined;
  var titlesReconnecting: IInertRecord | undefined;
  var desktopFailureCalls: string[] | undefined;
  var desktopSecondInstance: boolean | undefined;
  var openedLinks: string[] | undefined;
  var desktopOverlays: unknown[] | undefined;
  var desktopWindowCalls: string[] | undefined;
  var desktopWindowRestore: (() => void) | undefined;
  var desktopAskedBoxes: string[] | undefined;
  var nativePerformanceNow: (() => number) | undefined;
  var scrollReveals: WeakMap<Element, () => void> | undefined;
}
