/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WebViewPane } from "@noldova/desktop.protocol";

import { WebViewClosedException } from "../exceptions/web-view-closed.exception.js";
import type { IWebViewHandle } from "../interfaces/i-web-view-handle.js";
import type { IWindowWebViews } from "../interfaces/i-window-web-views.js";

export class WindowWebViews implements IWindowWebViews {
  private readonly open: (pane: WebViewPane, profileKey: string) => Promise<IWebViewHandle>;
  private readonly handles: Set<IWebViewHandle> = new Set();
  private isWithdrawn: boolean = false;

  public constructor(open: (pane: WebViewPane, profileKey: string) => Promise<IWebViewHandle>) {
    this.open = open;
  }

  public async openAsync(pane: WebViewPane, profileKey: string): Promise<IWebViewHandle> {
    const handle = await this.open(pane, profileKey);
    if (this.isWithdrawn) {
      handle.close();
      throw new WebViewClosedException();
    }
    for (const kept of [...this.handles].filter(t => t.isClosed))
      this.handles.delete(kept);
    this.handles.add(handle);
    return handle;
  }

  public withdraw(): void {
    this.isWithdrawn = true;
    for (const handle of [...this.handles].filter(t => !t.isClosed))
      handle.close();
    this.handles.clear();
  }
}
