/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { Injectable, type Signal, type WritableSignal, inject, signal } from "@angular/core";

import { EditAction } from "@noldova/desktop.protocol";

import type { ISelectionSource } from "../interfaces/i-selection-source.js";
import { EditTarget } from "../models/edit-target.js";
import { Resources } from "../../resources.js";

@Injectable({ providedIn: "root" })
export class EditTargetService {
  private readonly document: Document = inject(DOCUMENT);
  private readonly targetValue: WritableSignal<EditTarget | null> = signal(null);
  private readonly sources: Map<HTMLElement, ISelectionSource> = new Map();
  private readonly sourceElement: WritableSignal<HTMLElement | null> = signal(null, { equal: () => false });
  private readonly focusedElement: WritableSignal<HTMLElement | null> = signal(null);
  private readonly hasFocusValue: WritableSignal<boolean> = signal(this.document.hasFocus());

  public readonly target: Signal<EditTarget | null> = this.targetValue.asReadonly();
  public readonly hasFocus: Signal<boolean> = this.hasFocusValue.asReadonly();

  public constructor() {
    this.document.addEventListener(Resources.focusInEvent, event => this.follow(event.target), true);
    this.document.addEventListener(Resources.focusOutEvent, event => this.keep(event.target, event.relatedTarget), true);
    this.document.defaultView?.addEventListener(Resources.windowFocusEvent, () => this.hasFocusValue.set(true));
    this.document.defaultView?.addEventListener(Resources.windowBlurEvent, () => this.hasFocusValue.set(false));
  }

  public isEditFocused(): boolean {
    this.sourceElement();
    const element = this.focusedElement();
    return !Object.isNull(element) && element.isConnected &&
      (EditTarget.isEditable(element) || element.localName === Resources.webViewElement || !Object.isNull(this.sourceOf(element)));
  }

  public registerSource(element: HTMLElement, source: ISelectionSource): () => void {
    this.sources.set(element, source);
    if (element.contains(this.document.activeElement))
      this.sourceElement.set(element);
    return () => {
      if (this.sources.get(element) !== source)
        return;
      this.sources.delete(element);
      this.sourceElement.update(t => t);
    };
  }

  public sourceOf(element: Node): HTMLElement | null {
    return [...this.sources.keys()].filter(t => t.contains(element)).reduce<HTMLElement | null>((t, u) => Object.isNull(t) || t.contains(u) ? u : t, null);
  }

  public readSelection(): string | null {
    const source = this.focusedSource();
    return Object.isNull(source) || !source.hasSelection() ? null : source.readSelection();
  }

  public canRun(action: EditAction): boolean {
    if (action === EditAction.Copy && this.focusedSource()?.hasSelection() === true)
      return true;
    const target = this.targetValue();
    if (Object.isNull(target) || !target.element.isConnected)
      return false;
    switch (action) {
      case EditAction.Copy:
        return target.hasSelection;
      case EditAction.Cut:
        return target.hasSelection && target.isWritable;
      case EditAction.SelectAll:
        return true;
      default:
        return target.isWritable;
    }
  }

  public async restoreAsync(): Promise<boolean> {
    await Promise.resolve();
    const target = this.targetValue();
    if (Object.isNull(target) || !target.element.isConnected)
      return false;
    target.restore(this.document);
    return true;
  }

  private follow(element: EventTarget | null): void {
    if (!(element instanceof HTMLElement))
      return;
    if (!Object.isNull(element.closest(Resources.transientFocusSelector))) {
      if (EditTarget.isEditable(element))
        this.focusedElement.set(element);
      return;
    }
    this.focusedElement.set(element);
    this.sourceElement.set(this.sourceOf(element));
    this.targetValue.set(EditTarget.isEditable(element) ? EditTarget.capture(element, this.document) : null);
  }

  private keep(element: EventTarget | null, next: EventTarget | null): void {
    if (Object.isNull(next) && element === this.focusedElement())
      this.focusedElement.set(null);
    const sourceElement = this.sourceElement();
    if (!Object.isNull(sourceElement) && element instanceof Node && sourceElement.contains(element))
      this.sourceElement.update(t => t);
    const target = this.targetValue();
    if (!Object.isNull(target) && element === target.element)
      this.targetValue.set(EditTarget.capture(target.element, this.document));
  }

  private focusedSource(): ISelectionSource | null {
    const element = this.sourceElement();
    return Object.isNull(element) || !element.isConnected ? null : this.sources.get(element) ?? null;
  }
}
