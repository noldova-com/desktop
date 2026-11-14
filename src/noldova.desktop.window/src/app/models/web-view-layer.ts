/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ApplicationRef, type ComponentRef, type Injector, type Type, createComponent } from "@angular/core";
import "@noldova/context.core";

import type { IWebViewLayer } from "../interfaces/i-web-view-layer.js";
import { Resources } from "../../resources.js";

export class WebViewLayer<T> implements IWebViewLayer<T> {
  private readonly settlers: (() => void)[] = [];
  private readonly host: HTMLElement;
  private readonly ending: () => void;
  private isClosed: boolean = false;

  public readonly componentRef: ComponentRef<T>;
  public readonly closed: Promise<void> = new Promise(resolve => this.settlers.push(resolve));

  public constructor(frame: HTMLElement, component: Type<T>, injector: Injector, application: ApplicationRef, ending: () => void) {
    this.ending = ending;
    this.host = frame.ownerDocument.createElement(Resources.divElement);
    this.host.className = Resources.webViewLayerClass;
    for (const [name, value] of Object.entries(Resources.webViewLayerStyle))
      this.host.style.setProperty(name, value);
    frame.append(this.host);
    try {
      this.componentRef = createComponent(component, { environmentInjector: application.injector, elementInjector: injector, hostElement: this.host });
    }
    catch (error) {
      this.host.remove();
      throw error;
    }
    application.attachView(this.componentRef.hostView);
  }

  public close(): void {
    if (this.isClosed)
      return;
    this.isClosed = true;
    this.componentRef.destroy();
    this.host.remove();
    this.ending();
    for (const settle of this.settlers)
      settle();
  }
}
