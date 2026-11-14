/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, afterRenderEffect, computed, inject, untracked, viewChild } from "@angular/core";

import "@noldova/context.core";
import { ContextMenuTriggerDirective } from "@noldova/ui.components.angular";
import type { JsonObject } from "@noldova/context.json";

import { LinkService } from "../../services/link.service.js";
import { PlaceMenuComponent } from "../place-menu/place-menu.component.js";
import { Resources } from "../../../resources.js";

@Component({
  selector: "nol-link-menu",
  imports: [ContextMenuTriggerDirective, PlaceMenuComponent],
  templateUrl: "./link-menu.component.html",
  styleUrl: "./link-menu.component.css"
})
export class LinkMenuComponent {
  private readonly trigger: Signal<ContextMenuTriggerDirective> = viewChild.required(ContextMenuTriggerDirective);
  private readonly links: LinkService = inject(LinkService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly context: Signal<JsonObject> = computed(() => {
    const request = this.links.menu();
    return Object.isNull(request) ? {} : { [Resources.urlArgument]: request.url };
  });

  public constructor() {
    afterRenderEffect(() => {
      const request = this.links.menu();
      const target = LinkMenuComponent.elementOf(request?.event.target ?? null);
      if (!Object.isNull(request) && !Object.isNull(target))
        untracked(() => this.trigger().openAtPointer(request.event, target));
    });
  }

  private static elementOf(target: EventTarget | null): HTMLElement | null {
    let element = target instanceof Element ? target : null;
    while (!Object.isNull(element) && !(element instanceof HTMLElement))
      element = element.parentElement;
    return element;
  }
}
