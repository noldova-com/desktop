/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.js";
import type { WindowAppearance } from "./window-appearance.js";

export class WebViewRefusedPage {
  private readonly name: string;
  private readonly readAppearance: () => WindowAppearance | null | undefined;

  public constructor(name: unknown, readAppearance: () => WindowAppearance | null | undefined) {
    const text = Object.isString(name) ? name.trim() : String.empty;
    this.name = [...text].slice(0, Resources.refusedPageNameLimit).join(String.empty);
    this.readAppearance = readAppearance;
  }

  public format(origin: string, nonce: string): string {
    const appearance = this.readAppearance();
    const shown = WebViewRefusedPage.escape([...origin].slice(0, Resources.refusedPageOriginLimit).join(String.empty));
    const name = WebViewRefusedPage.escape(this.name);
    const [title, reason] = String.isNullOrWhitespace(name)
      ? [Resources.formatNamelessRefusedTitle(shown), Resources.namelessRefusedReason]
      : [Resources.formatRefusedTitle(name, shown), Resources.formatRefusedReason(name)];
    const html = Resources.formatRefusedPage(title, reason, appearance?.background ?? Resources.refusedPageBackground, appearance?.titleBarText ?? Resources.refusedPageText, nonce);
    return `${Resources.refusedPagePrefix}${Buffer.from(html, "utf8").toString("base64")}`;
  }

  private static escape(text: string): string {
    return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
  }
}
