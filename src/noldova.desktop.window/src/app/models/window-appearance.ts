/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class WindowAppearance {
  public readonly background: string;
  public readonly titleBar: string;
  public readonly titleBarText: string;
  public readonly titleBarHeight: number;

  public constructor(background: string, titleBar: string, titleBarText: string, titleBarHeight: number) {
    this.background = background;
    this.titleBar = titleBar;
    this.titleBarText = titleBarText;
    this.titleBarHeight = titleBarHeight;
  }

  public static read(windowRow: HTMLElement, covers: readonly HTMLElement[] = []): WindowAppearance {
    const rowStyle = getComputedStyle(windowRow);
    const background = getComputedStyle(windowRow.ownerDocument.body).backgroundColor;
    const probe = windowRow.ownerDocument.createElement(Resources.spanElement);
    probe.hidden = true;
    windowRow.ownerDocument.body.append(probe);
    try {
      const srgb = (color: string, opacity: number = 1): readonly number[] => {
        probe.style.color = Resources.formatSrgbColor(color);
        const channels = Array.from(getComputedStyle(probe).color.matchAll(Resources.colorChannelPattern),
          t => t[0] === Resources.missingColorComponent ? 0 : Math.min(1, Math.max(0, Number(t[0]))));
        return [...channels.slice(0, Resources.colorChannels), Math.min(1, ...channels.slice(Resources.alphaIndex)) * opacity];
      };
      const shades = covers.map(t => getComputedStyle(t)).map(t => srgb(t.backgroundColor, Number(t.opacity)));
      const page = srgb(background);
      const titleBar = srgb(rowStyle.backgroundColor);
      const text = srgb(rowStyle.color);
      return new WindowAppearance(background, WindowAppearance.paint([page, titleBar, ...shades]), WindowAppearance.paint([page, titleBar, text, ...shades]),
        Math.round(windowRow.getBoundingClientRect().height));
    }
    finally {
      probe.remove();
    }
  }

  public toJson(): JsonObject {
    return {
      [Resources.backgroundField]: this.background,
      [Resources.titleBarField]: this.titleBar,
      [Resources.titleBarTextField]: this.titleBarText,
      [Resources.titleBarHeightField]: this.titleBarHeight
    };
  }

  private static paint(layers: readonly (readonly number[])[]): string {
    const painted = layers.reduce((below, layer) => {
      const alpha = Number(layer[Resources.alphaIndex]);
      return [0, 1, 2, 3].map(index => (index === Resources.alphaIndex ? alpha : Number(layer[index]) * alpha) + Number(below[index]) * (1 - alpha));
    }, [0, 0, 0, 0]);
    const alpha = Number(painted[Resources.alphaIndex]);
    const shown = Number(alpha.toFixed(Resources.alphaDigits));
    const channels = painted.slice(0, Resources.colorChannels).map(t => Math.round(t / Math.max(alpha, Number.EPSILON) * Resources.channelMaximum));
    return shown === 1 ? Resources.formatRgb(channels) : Resources.formatRgba(channels, shown);
  }
}
