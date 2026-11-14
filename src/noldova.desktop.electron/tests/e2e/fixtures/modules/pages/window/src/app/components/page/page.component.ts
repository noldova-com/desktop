/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import {
  afterNextRender, Component, DestroyRef, type ElementRef, inject, input, type InputSignal, type Signal, signal, viewChild, type WritableSignal
} from "@angular/core";

import { QualifiedName, type WebViewEvent, WebViewEventKind, WebViewPane } from "@noldova/desktop.protocol";
import { type IWebViewHandle, type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";

import { MarkComponent } from "../mark/mark.component";

@Component({
  selector: "nol-pages-page",
  templateUrl: "./page.component.html",
  styleUrl: "./page.component.css"
})
export class PageComponent {
  private static readonly PROFILE_KEY: string = "main";
  private static readonly VIEW_COUNT: number = 2;
  private static readonly SEARCHES: ReadonlyMap<string, string> = new Map([["find", "Second"], ["findLetter", "e"], ["findMissing", "Nowhere"]]);
  private static readonly STEPS: readonly string[] = ["next", "previous"];

  public readonly instance: InputSignal<string> = input.required<string>();
  public readonly title: InputSignal<string> = input.required<string>();

  protected readonly views: WritableSignal<readonly { id: string; event: string; title: string; keys: string; requests: string; zoom: string; found: string }[]> = signal([]);
  protected readonly failure: WritableSignal<string> = signal(String.empty);
  protected readonly layer: WritableSignal<string> = signal("none");
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly content: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("content");
  private readonly handles: IWebViewHandle[] = [];
  private isClosed: boolean = false;

  public constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.isClosed = true;
      for (const handle of this.handles.splice(0))
        handle.close();
    });
    afterNextRender(() => {
      this.openAsync().catch((error: unknown) => this.failure.set(`The web views did not open: ${String(error)}`));
    });
  }

  private async openAsync(): Promise<void> {
    const pane = new WebViewPane(QualifiedName.parse("pages.page"), this.instance());
    for (let index = 0; index < PageComponent.VIEW_COUNT; index++) {
      const handle = await this.context.webViews.openAsync(pane, PageComponent.PROFILE_KEY);
      if (this.isClosed) {
        handle.close();
        return;
      }
      this.handles.push(handle);
      handle.mount(this.content().nativeElement);
      this.views.update(t => [...t, { id: handle.id, event: String.empty, title: String.empty, keys: String.empty, requests: String.empty, zoom: String.empty, found: String.empty }]);
      handle.subscribe(t => this.receive(handle.id, t));
    }
    this.handles[0]?.show();
  }

  private receive(id: string, event: WebViewEvent): void {
    const title = event.kind === WebViewEventKind.State ? String(event.details["title"]) : null;
    const key = event.kind === WebViewEventKind.Key ? String(event.details["name"]) : null;
    const address = event.kind === WebViewEventKind.NewWindowRequested ? String(event.details["address"]) : null;
    const request = Object.isNull(address) ? String.empty : `${address} ${String(event.details["hadRecentInput"])} ${String(event.details["origin"])}\n`;
    const zoom = event.kind === WebViewEventKind.Zoom ? String(event.details["factor"]) : null;
    this.views.update(list => list.map(t => t.id === id
      ? { ...t, event: event.kind, title: title ?? t.title, keys: Object.isNull(key) ? t.keys : `${t.keys}${key} `, requests: `${t.requests}${request}`, zoom: zoom ?? t.zoom }
      : t));
    if (!Object.isNull(key) && (PageComponent.SEARCHES.has(key) || PageComponent.STEPS.includes(key)))
      this.findAsync(id, key).catch((error: unknown) => this.failure.set(`The search failed: ${String(error)}`));
    if (!Object.isNull(address))
      void this.handles[1]?.navigateAsync(address);
    if (key === "mark")
      this.markAsync(id).catch((error: unknown) => this.failure.set(`The layer failed: ${String(error)}`));
  }

  private async markAsync(id: string): Promise<void> {
    const handle = this.handles.find(t => t.id === id);
    if (Object.isUndefined(handle))
      return;
    const layer = await handle.openLayerAsync(() => Promise.resolve(MarkComponent));
    this.layer.set("open");
    await layer.closed;
    this.layer.set("closed");
  }

  private async findAsync(id: string, key: string): Promise<void> {
    const handle = this.handles.find(t => t.id === id);
    if (Object.isUndefined(handle))
      return;
    const text = PageComponent.SEARCHES.get(key);
    const found = !Object.isUndefined(text) ? await handle.findAsync(text) : key === "next" ? await handle.findNextAsync() : await handle.findPreviousAsync();
    this.views.update(list => list.map(t => t.id === id ? { ...t, found: `${found.matches} ${found.active}` } : t));
  }
}
