/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, ErrorHandler, Injectable, type Signal, type WritableSignal, effect, inject, signal, untracked } from "@angular/core";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { AgentControlState, ShellEvents, ShellMethods } from "@noldova/desktop.protocol";

import { PreloadBridgeService } from "./preload-bridge.service.js";
import { WindowPartHostService } from "./window-part-host.service.js";

@Injectable({ providedIn: "root" })
export class AgentControlService {
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly stateValue: WritableSignal<AgentControlState | null> = signal(null);
  private eventsSeen: number = 0;
  private generationRead: number = 0;

  public readonly state: Signal<AgentControlState | null> = this.stateValue.asReadonly();

  public constructor() {
    const host = inject(WindowPartHostService);
    inject(DestroyRef).onDestroy(this.bridge.onEvent((name, payload) => this.receive(name, payload)));
    effect(() => {
      const generation = host.generation();
      if (generation > this.generationRead) {
        this.generationRead = generation;
        untracked(() => this.load());
      }
    });
  }

  private load(): void {
    const seen = this.eventsSeen;
    this.bridge.requestAsync(ShellMethods.agentControl.text, null).then(t => {
      if (this.eventsSeen === seen)
        this.stateValue.set(AgentControlState.fromJson(t));
    }).catch((error: unknown) => this.errors.handleError(error));
  }

  private receive(name: string, payload: JsonValue): void {
    if (name !== ShellEvents.agentControlChanged.text)
      return;
    this.eventsSeen++;
    try {
      this.stateValue.set(AgentControlState.fromJson(payload));
    }
    catch (error) {
      this.errors.handleError(error);
    }
  }
}
