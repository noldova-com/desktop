/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import { UndoProviderTakenException } from "../exceptions/undo-provider-taken.exception.js";
import type { IUndoProvider } from "../interfaces/i-undo-provider.js";
import { EditTargetService } from "./edit-target.service.js";

@Injectable({ providedIn: "root" })
export class UndoService {
  private readonly edits: EditTargetService = inject(EditTargetService);
  private readonly provider: WritableSignal<IUndoProvider | null> = signal(null);

  public readonly takesUndo: Signal<boolean> = computed(() => !Object.isNull(this.provider()) && this.edits.hasFocus() && !this.edits.isEditFocused());

  public provide(provider: IUndoProvider): () => void {
    if (!Object.isNull(this.provider()))
      throw new UndoProviderTakenException();
    this.provider.set(provider);
    return () => {
      if (this.provider() === provider)
        this.provider.set(null);
    };
  }

  public canUndo(): boolean {
    const provider = this.provider();
    return this.takesUndo() && !Object.isNull(provider) && provider.canUndo();
  }

  public async undoAsync(): Promise<void> {
    const provider = this.provider();
    if (this.takesUndo() && !Object.isNull(provider) && provider.canUndo())
      await provider.undoAsync();
  }
}
