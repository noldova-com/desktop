/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Component, DestroyRef, inject, signal, type WritableSignal } from "@angular/core";

import { JsonReader } from "@noldova/context.json";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";

@Component({
  selector: "nol-clock-face",
  templateUrl: "./clock-face.component.html"
})
export class ClockFaceComponent {
  protected readonly answer: WritableSignal<string> = signal(String.empty);
  protected readonly ticks: WritableSignal<string> = signal("No ticks");
  protected readonly step: WritableSignal<number> = signal(1);
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);

  public constructor() {
    this.step.set(Number(this.context.readSetting("clock.tickStep")));
    inject(DestroyRef).onDestroy(this.context.onSettingChanged("clock.tickStep", t => this.step.set(Number(t))));
    inject(DestroyRef).onDestroy(this.context.onEvent("clock.ticked", t => this.ticks.set(`Ticks: ${JsonReader.fromValue(t).readInteger("ticks")}`)));
    this.context.requestAsync("clock.time", null).then(
      t => this.answer.set(`The runtime's time is ${JsonReader.fromValue(t).readString("time")}`),
      (error: unknown) => this.answer.set(`The runtime did not answer: ${String(error)}`));
  }

  protected stepUp(): void {
    void this.context.writeSettingAsync("clock.tickStep", this.step() % 5 + 1);
  }
}
