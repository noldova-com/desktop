/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgComponentOutlet } from "@angular/common";
import { Component, ElementRef, Injector, type InputSignal, type ResourceRef, type Signal, computed, inject, input, resource, signal } from "@angular/core";

import "@noldova/context.core";

import { ContentPadding } from "../../enums/content-padding.js";
import type { ContributionMatch } from "../../models/contribution-match.js";
import { ContentPaddingRef } from "../../models/content-padding-ref.js";
import { TabContent } from "../../models/tab-content.js";
import { WindowPartTokens } from "../../models/window-part-tokens.js";

@Component({
  selector: "nol-placeholder-content",
  imports: [NgComponentOutlet],
  templateUrl: "./placeholder-content.component.html",
  styleUrl: "./placeholder-content.component.css",
  host: {
    "[class.nol-placeholder-content-padded]": "isPadded()"
  }
})
export class PlaceholderContentComponent {
  private readonly injector: Injector = inject(Injector);

  protected readonly content: ResourceRef<TabContent | undefined> = resource({
    params: () => ({ match: this.match() }),
    loader: ({ params }) => this.loadAsync(params.match)
  });
  protected readonly isPadded: Signal<boolean> = computed(() => {
    if (!this.content.hasValue())
      return false;
    const value = this.content.value();
    return (value.pagePadding.value() ?? value.padding) === ContentPadding.Default;
  });

  public readonly element: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  public readonly match: InputSignal<ContributionMatch> = input.required<ContributionMatch>();
  public readonly isLoaded: Signal<boolean> = computed(() => this.content.hasValue());

  private async loadAsync(match: ContributionMatch): Promise<TabContent> {
    const component = await match.loadComponent();
    const pagePadding = new ContentPaddingRef();
    const injector = Injector.create({
      providers: [
        { provide: WindowPartTokens.context, useValue: match.context },
        { provide: WindowPartTokens.contentPadding, useValue: pagePadding },
        { provide: WindowPartTokens.shown, useValue: signal(true).asReadonly() },
        { provide: WindowPartTokens.activeDocument, useValue: signal(false).asReadonly() }
      ],
      parent: this.injector
    });
    return new TabContent(component, injector, {}, match.padding, pagePadding);
  }
}
