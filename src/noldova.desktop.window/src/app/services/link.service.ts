/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { DOCUMENT } from "@angular/common";
import { ErrorHandler, Injectable, type Signal, type WritableSignal, inject, signal } from "@angular/core";

import { LinkPolicy } from "@noldova/desktop.protocol";
import { LinkGesture, LinkMenuEvent, LinkOpenEvent } from "@noldova/ui.components.angular";

import { LinkPlace } from "../enums/link-place.js";
import { InAppBrowserTakenException } from "../exceptions/in-app-browser-taken.exception.js";
import { LinkNotOpenedException } from "../exceptions/link-not-opened.exception.js";
import type { IInAppBrowser } from "../interfaces/i-in-app-browser.js";
import type { ILinkOpenOptions } from "../interfaces/i-link-open-options.js";
import { PreloadBridgeService } from "./preload-bridge.service.js";
import { ProductName } from "../models/product-name.js";
import { Resources } from "../../resources.js";

@Injectable({ providedIn: "root" })
export class LinkService {
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);
  private readonly document: Document = inject(DOCUMENT);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly browserState: WritableSignal<{ readonly browser: IInAppBrowser; readonly log: (message: string) => void } | null> = signal(null);
  private readonly menuState: WritableSignal<LinkMenuEvent | null> = signal(null);

  public readonly menu: Signal<LinkMenuEvent | null> = this.menuState.asReadonly();

  public get hasInAppBrowser(): boolean {
    return !Object.isNull(this.browserState());
  }

  public static isWeb(url: string): boolean {
    return URL.canParse(url) && Resources.webProtocols.includes(new URL(url).protocol);
  }

  public listen(): () => void {
    const open = (event: MouseEvent): void => this.openClicked(event);
    const showMenu = (event: MouseEvent): void => this.showClickedMenu(event);
    this.document.addEventListener(Resources.clickEvent, open);
    this.document.addEventListener(Resources.auxClickEvent, open);
    this.document.addEventListener(Resources.contextMenuEvent, showMenu);
    return () => {
      this.document.removeEventListener(Resources.clickEvent, open);
      this.document.removeEventListener(Resources.auxClickEvent, open);
      this.document.removeEventListener(Resources.contextMenuEvent, showMenu);
    };
  }

  public register(browser: IInAppBrowser, log: (message: string) => void): () => void {
    if (this.hasInAppBrowser)
      throw new InAppBrowserTakenException();
    const registered = { browser, log };
    this.browserState.set(registered);
    return () => {
      if (this.browserState() === registered)
        this.browserState.set(null);
    };
  }

  public async openAsync(url: string, options: ILinkOpenOptions = {}): Promise<void> {
    if (await this.openInAppAsync(url, options))
      return;
    if (!await this.bridge.openLinkAsync(url))
      throw new LinkNotOpenedException(ProductName.current);
  }

  public showMenu(url: string, event: MouseEvent): void {
    if (!LinkService.isWeb(url))
      return;
    event.preventDefault();
    this.menuState.set(new LinkMenuEvent(url, event));
  }

  private async openInAppAsync(url: string, options: ILinkOpenOptions): Promise<boolean> {
    const registered = this.browserState();
    const link = LinkPolicy.findAllowed(url);
    if (Object.isNull(registered) || Object.isNull(link) || !LinkService.isWeb(link))
      return false;
    try {
      if ((options.place ?? registered.browser.placeFor(link, options.gesture ?? LinkGesture.Plain)) !== LinkPlace.InApp)
        return false;
      await registered.browser.openAsync(link);
      return true;
    }
    catch (error) {
      registered.log(Resources.formatInAppLinkFailed(error));
      return false;
    }
  }

  private openClicked(event: MouseEvent): void {
    const link = this.linkOf(event);
    if (Object.isNull(link))
      return;
    event.preventDefault();
    this.openAsync(link.href, { gesture: new LinkOpenEvent(link.href, event).gesture }).catch((error: unknown) => this.errors.handleError(error));
  }

  private showClickedMenu(event: MouseEvent): void {
    const link = this.linkOf(event);
    if (!Object.isNull(link))
      this.showMenu(link.href, event);
  }

  private linkOf(event: MouseEvent): HTMLAnchorElement | null {
    const isOtherButton = event.type !== Resources.contextMenuEvent && event.button > Resources.middleButton;
    if (event.defaultPrevented || isOtherButton || !(event.target instanceof Element))
      return null;
    const link = event.target.closest(Resources.linkSelector);
    return link instanceof HTMLAnchorElement && LinkService.withoutFragment(link.href) !== LinkService.withoutFragment(this.document.URL) ? link : null;
  }

  private static withoutFragment(url: string): string {
    const parsed = new URL(url);
    parsed.hash = String.empty;
    return parsed.href;
  }
}
