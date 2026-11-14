/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, DestroyRef, type Signal, type WritableSignal, inject, signal, viewChild } from "@angular/core";

import "@noldova/context.core";
import { ContextMenuTriggerDirective } from "@noldova/ui.components.angular";
import type { JsonObject } from "@noldova/context.json";

import { EditTarget } from "../../models/edit-target.js";
import type { FieldMenuRequest } from "../../models/field-menu-request.js";
import { EditTargetService } from "../../services/edit-target.service.js";
import { PreloadBridgeService } from "../../services/preload-bridge.service.js";
import { PlaceMenuComponent } from "../place-menu/place-menu.component.js";
import { Resources } from "../../../resources.js";

@Component({
  selector: "nol-field-menu",
  imports: [ContextMenuTriggerDirective, PlaceMenuComponent],
  templateUrl: "./field-menu.component.html",
  styleUrl: "./field-menu.component.css",
  host: {
    "(document:contextmenu)": "noteFromPointer($event)",
    "(document:keydown)": "noteFromKeyboard($event)"
  }
})
export class FieldMenuComponent {
  private readonly trigger: Signal<ContextMenuTriggerDirective> = viewChild.required(ContextMenuTriggerDirective);
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);
  private readonly edits: EditTargetService = inject(EditTargetService);
  private pending: readonly [HTMLElement, MouseEvent | KeyboardEvent] | null = null;

  protected readonly resources: typeof Resources = Resources;
  protected readonly context: WritableSignal<JsonObject> = signal({});

  public constructor() {
    const stop = this.bridge.onFieldMenu(t => this.answer(t));
    inject(DestroyRef).onDestroy(stop);
  }

  protected noteFromPointer(event: MouseEvent): void {
    const field = this.targetOf(event, true);
    if (Object.isNull(field) || (this.pending?.[0] === field && this.pending[1] instanceof KeyboardEvent))
      return;
    this.note(field, event);
  }

  protected noteFromKeyboard(event: KeyboardEvent): void {
    if (event.key !== Resources.contextMenuKey && !(event.key === Resources.functionKey && event.shiftKey))
      return;
    const field = this.targetOf(event, false);
    if (Object.isNull(field))
      return;
    this.note(field, event);
    if (this.bridge.isMac)
      this.open(null);
  }

  private note(field: HTMLElement, event: MouseEvent | KeyboardEvent): void {
    this.pending = [field, event];
  }

  private answer(request: FieldMenuRequest): void {
    const event = this.pending?.[1];
    if (Object.isUndefined(event) || request.isKeyboard !== event instanceof KeyboardEvent)
      return;
    if (event instanceof MouseEvent && (Math.abs(request.x - event.clientX) > Resources.fieldMenuSlack || Math.abs(request.y - event.clientY) > Resources.fieldMenuSlack))
      return;
    this.open(request);
  }

  private open(request: FieldMenuRequest | null): void {
    const pending = this.pending;
    this.pending = null;
    if (Object.isNull(pending) || !pending[0].isConnected)
      return;
    const [noted, event] = pending;
    const field = EditTarget.fieldOf(noted) === noted ? noted : FieldMenuComponent.focusedIn(noted);
    if (Object.isNull(field))
      return;
    this.context.set(request?.toContext() ?? {});
    if (event instanceof KeyboardEvent)
      this.trigger().openFromKeyboard(event, field);
    else
      this.trigger().openAtPointer(event, field);
  }

  private targetOf(event: Event, isPointer: boolean): HTMLElement | null {
    const element = event.target;
    if (event.defaultPrevented || !(element instanceof HTMLElement) || !Object.isNull(element.closest(Resources.transientFocusSelector)))
      return null;
    return EditTarget.fieldOf(element) ?? (isPointer ? this.edits.sourceOf(element) : null);
  }

  private static focusedIn(source: HTMLElement): HTMLElement | null {
    const active = source.ownerDocument.activeElement;
    return active instanceof HTMLElement && source.contains(active) ? active : null;
  }
}
