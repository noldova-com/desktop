/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { InteractivityChecker } from "@angular/cdk/a11y";
import { DOCUMENT } from "@angular/common";
import { Injectable, inject } from "@angular/core";

import "@noldova/context.core";

import { RegionStop } from "../models/region-stop.js";
import { Resources } from "../../resources.js";

@Injectable({ providedIn: "root" })
export class RegionFocusService {
  private readonly document: Document = inject(DOCUMENT);
  private readonly checker: InteractivityChecker = inject(InteractivityChecker);

  public move(step: number): void {
    const stops = this.stops();
    const focused = [...this.document.querySelectorAll(Resources.focusedSelector)];
    const current = stops.findIndex(t => focused.some(u => t.holds(u)));
    const from = current >= 0 || step > 0 ? current : stops.length;
    const next = (from + step + stops.length) % stops.length;
    stops.slice(next, next + 1).forEach(t => t.target.focus());
  }

  public hasStops(): boolean {
    return this.stops().length > 0;
  }

  private stops(): readonly RegionStop[] {
    return [...this.document.querySelectorAll<HTMLElement>(Resources.regionSelector)].flatMap(region => {
      const guests = [...region.querySelectorAll<HTMLElement>(Resources.webViewGuestSelector)].filter(t => t.checkVisibility(Resources.regionVisibility));
      const isInView = (element: Element, guest: HTMLElement): boolean => element.closest(Resources.webViewFrameSelector)?.contains(guest) === true;
      const isOutside = (element: Element): boolean => !guests.some(t => isInView(element, t));
      const target = this.firstTabbable(region.querySelector<HTMLElement>(Resources.regionContentSelector), isOutside) ?? this.firstTabbable(region, isOutside);
      const own = Object.isNull(target) ? [] : [new RegionStop(target, t => region.contains(t) && isOutside(t))];
      return [...own, ...guests.map(guest => new RegionStop(guest, t => isInView(t, guest)))];
    });
  }

  private firstTabbable(root: HTMLElement | null, isOutside: (element: Element) => boolean): HTMLElement | null {
    if (Object.isNull(root))
      return null;
    return [...root.querySelectorAll<HTMLElement>(Resources.tabbableSelector)].find(t => isOutside(t) && this.checker.isFocusable(t) && this.checker.isTabbable(t)) ?? null;
  }
}
