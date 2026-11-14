/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { NgTemplateOutlet } from "@angular/common";
import { Component, type Signal, computed, input } from "@angular/core";

import { TextMatch } from "../../models/settings/text-match.js";
import { WordBreaks } from "../../models/settings/word-breaks.js";

@Component({
  selector: "nol-highlighted-text",
  imports: [NgTemplateOutlet],
  templateUrl: "./highlighted-text.component.html",
  styleUrl: "./highlighted-text.component.css"
})
export class HighlightedTextComponent {
  protected readonly parts: Signal<readonly TextMatch[]> = computed(() => {
    const parts = TextMatch.split(this.text(), this.query());
    return this.breaksWords() ? WordBreaks.split(parts) : parts;
  });

  public readonly text = input.required<string>();
  public readonly query = input<string>(String.empty);
  public readonly breaksWords = input<boolean>(false);
}
