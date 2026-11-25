/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type WritableSignal, signal } from "@angular/core";

export class NotesState {
  public static readonly sortBy: WritableSignal<string> = signal("week");
  public static readonly wrapsLines: WritableSignal<boolean> = signal(false);
  public static readonly runtime: WritableSignal<string> = signal(String.empty);
  public static readonly continued: WritableSignal<number> = signal(0);
  public static readonly isUndoable: WritableSignal<boolean> = signal(true);
  public static readonly undone: WritableSignal<number> = signal(0);
  public static readonly saving: WritableSignal<"saves" | "fails" | "hangs"> = signal("saves");
}
