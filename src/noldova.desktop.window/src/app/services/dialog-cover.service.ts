/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { FocusTrapFactory } from "@angular/cdk/a11y";
import { Dialog, type DialogRef } from "@angular/cdk/dialog";
import { DestroyRef, Injectable, type Signal, type WritableSignal, computed, effect, inject, signal, untracked } from "@angular/core";

import { Resources } from "../../resources.js";
import { StartupService } from "./startup.service.js";

@Injectable({ providedIn: "root" })
export class DialogCoverService {
  private readonly dialog: Dialog = inject(Dialog);
  private readonly startup: StartupService = inject(StartupService);
  private readonly focusTraps: FocusTrapFactory = inject(FocusTrapFactory);
  private readonly open: WritableSignal<ReadonlySet<DialogRef<unknown, unknown>>> = signal(new Set(this.dialog.openDialogs));
  private covered: Map<DialogRef<unknown, unknown>, readonly [HTMLElement, boolean | undefined]> = new Map();
  private focused: HTMLElement | null = null;
  private cover: HTMLElement | null = null;

  public readonly openDialogs: Signal<ReadonlySet<DialogRef<unknown, unknown>>> = this.open.asReadonly();
  public readonly isCovering: Signal<boolean> = computed(() => this.startup.isReconnecting() && this.open().size > 0);

  public constructor() {
    for (const reference of this.dialog.openDialogs)
      this.follow(reference);
    const opened = this.dialog.afterOpened.subscribe(t => {
      this.follow(t);
      this.open.update(u => new Set([...u, t]));
      if (untracked(() => this.isCovering()))
        this.coverDialogs();
    });
    inject(DestroyRef).onDestroy(() => opened.unsubscribe());
    effect(() => {
      if (this.isCovering())
        untracked(() => this.coverDialogs());
      else
        untracked(() => this.uncoverDialogs());
    });
  }

  public attach(cover: HTMLElement): void {
    this.cover = cover;
    this.raise();
  }

  public detach(): void {
    this.cover = null;
  }

  private follow(reference: DialogRef<unknown, unknown>): void {
    reference.closed.subscribe(() => this.open.update(t => new Set([...t].filter(u => u !== reference))));
  }

  private coverDialogs(): void {
    for (const reference of this.open()) {
      if (this.covered.has(reference))
        continue;
      const host = reference.overlayRef.hostElement;
      const active = document.activeElement;
      if (active instanceof HTMLElement && host.contains(active))
        this.focused = active;
      host.setAttribute(Resources.inertAttribute, String.empty);
      this.covered.set(reference, [host, reference.disableClose]);
      reference.disableClose = true;
    }
    this.raise();
  }

  private uncoverDialogs(): void {
    const covered = this.covered;
    for (const [reference, [host, disableClose]] of covered) {
      host.removeAttribute(Resources.inertAttribute);
      reference.disableClose = disableClose;
    }
    this.covered = new Map();
    const focused = this.focused;
    this.focused = null;
    const topmost = this.dialog.openDialogs.findLast(t => covered.has(t));
    if (!Object.isNull(focused) && focused.isConnected)
      focused.focus({ preventScroll: true });
    else if (!Object.isUndefined(topmost)) {
      const pane = topmost.overlayRef.overlayElement;
      this.focusInto(pane.querySelector<HTMLElement>(Resources.dialogContainerSelector) ?? pane);
    }
  }

  private focusInto(container: HTMLElement): void {
    const trap = this.focusTraps.create(container, true);
    if (!trap.focusFirstTabbableElement({ preventScroll: true }))
      container.focus({ preventScroll: true });
    trap.destroy();
  }

  private raise(): void {
    if (!Object.isNull(this.cover))
      this.cover.parentElement?.append(this.cover);
  }
}
