/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ViewTab } from "./layout/view-tab.js";

export class ViewPlace {
  public readonly view: string;
  public readonly instance: string | null;
  public readonly place: string;

  public constructor(view: string, instance: string | null, place: string) {
    this.view = view;
    this.instance = instance;
    this.place = place;
  }

  public get tab(): ViewTab {
    return new ViewTab(this.view, this.instance ?? undefined);
  }

  public equals(other: unknown): boolean {
    return other instanceof ViewPlace && other.view === this.view && other.instance === this.instance && other.place === this.place;
  }
}
