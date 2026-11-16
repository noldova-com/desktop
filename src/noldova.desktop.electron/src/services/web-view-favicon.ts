/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { isIP } from "node:net";
import type { IWebViewContents } from "../interfaces/i-web-view-contents.js";
import type { IWebViewSession } from "../interfaces/i-web-view-session.js";
import { Resources } from "../resources.js";
import { WebViewFaviconResources } from "./web-view-favicon.resources.js";
import type { WebViewOriginCheck } from "./web-view-origin-check.js";

export class WebViewFavicon {
  private readonly session: IWebViewSession;
  private readonly check: WebViewOriginCheck;
  private readonly readAllowed: () => readonly string[];
  private readonly waitAsync: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  private readonly report: (image: string | null) => void;
  private readonly fetches: string[] = [];
  private image: string | null = null;
  private isNamed: boolean = false;
  private read: AbortController = new AbortController();

  public constructor(session: IWebViewSession, check: WebViewOriginCheck, readAllowed: () => readonly string[],
    waitAsync: (milliseconds: number, signal: AbortSignal) => Promise<void>, report: (image: string | null) => void) {
    this.session = session;
    this.check = check;
    this.readAllowed = readAllowed;
    this.waitAsync = waitAsync;
    this.report = report;
  }

  public allowsRequest(url: string): boolean {
    return this.fetches.includes(url) && this.check.allowsNavigation(url, this.readAllowed(), false);
  }

  public noteNavigation(): void {
    this.isNamed = false;
    this.drop();
  }

  public noteStop(): void {
    if (this.isNamed)
      return;
    this.drop();
    this.show(null);
  }

  public close(): void {
    this.drop();
  }

  public async updateAsync(guest: IWebViewContents, candidates: readonly string[]): Promise<void> {
    this.isNamed = true;
    const signal = this.drop();
    for (const url of candidates.slice(0, WebViewFaviconResources.candidateLimit)) {
      const image = await this.readAsync(guest, url, signal);
      if (signal.aborted)
        return;
      if (!Object.isNull(image))
        return this.show(image);
    }
    this.show(null);
  }

  private static toImage(value: unknown): string | null {
    if (!Object.isString(value) || value.length > WebViewFaviconResources.base64Limit || !WebViewFaviconResources.base64Pattern.test(value))
      return null;
    return WebViewFavicon.isIcon(Buffer.from(value, Resources.base64Encoding)) ? `${WebViewFaviconResources.pngPrefix}${value}` : null;
  }

  private static isIcon(png: Buffer): boolean {
    const { pngSignature, pngLimit, headerStart, headerEnd, headerType, widthOffset, heightOffset, side } = WebViewFaviconResources;
    if (png.length < headerEnd || png.length > pngLimit || !pngSignature.every((t, index) => png[index] === t) || png.toString(Resources.latin1Encoding, headerStart, widthOffset) !== headerType)
      return false;
    return [png.readUInt32BE(widthOffset), png.readUInt32BE(heightOffset)].every(t => t >= 1 && t <= side);
  }

  private async readAsync(guest: IWebViewContents, url: string, signal: AbortSignal): Promise<string | null> {
    if (!await this.allowsAsync(url))
      return null;
    const bytes = await this.fetchAsync(url, signal);
    return Object.isNull(bytes) || signal.aborted ? null : this.decodeAsync(guest, bytes);
  }

  private async allowsAsync(url: string): Promise<boolean> {
    const parsed = URL.parse(url);
    if (Object.isNull(parsed) || !Resources.webViewSchemes.includes(parsed.protocol) || !this.check.allowsNavigation(url, this.readAllowed(), false))
      return false;
    const host = parsed.hostname.replace(Resources.webViewBracketsPattern, String.empty);
    const addresses = isIP(host) !== 0 ? [host] : await this.session.resolveHostAsync(host).catch(() => []);
    return addresses.length > 0 && addresses.every(t => this.check.allowsConnection(url, this.readAllowed(), t));
  }

  private async fetchAsync(url: string, signal: AbortSignal): Promise<Uint8Array | null> {
    const late = new AbortController();
    const deadline = new AbortController();
    void this.waitAsync(WebViewFaviconResources.fetchTimeout, deadline.signal).then(() => late.abort(), () => undefined);
    this.fetches.push(url);
    try {
      return await this.session.readIconAsync(url, WebViewFaviconResources.byteLimit, AbortSignal.any([signal, late.signal])).catch(() => null);
    }
    finally {
      deadline.abort();
      this.fetches.splice(this.fetches.indexOf(url), 1);
    }
  }

  private async decodeAsync(guest: IWebViewContents, bytes: Uint8Array): Promise<string | null> {
    const timeout = new AbortController();
    const script = WebViewFaviconResources.formatDecodeScript(Buffer.from(bytes).toString(Resources.base64Encoding));
    const decoded = guest.executeJavaScriptInIsolatedWorld(WebViewFaviconResources.decodeWorld, [{ code: script }]).catch(() => null);
    const expired = this.waitAsync(WebViewFaviconResources.decodeTimeout, timeout.signal).then(() => null, () => null);
    const value = await Promise.race([decoded, expired]);
    timeout.abort();
    return WebViewFavicon.toImage(value);
  }

  private drop(): AbortSignal {
    this.read.abort();
    this.read = new AbortController();
    return this.read.signal;
  }

  private show(image: string | null): void {
    if (image === this.image)
      return;
    this.image = image;
    this.report(image);
  }
}
