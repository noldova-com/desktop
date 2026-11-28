/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injector, type Provider, type Signal, type WritableSignal, signal } from "@angular/core";

import { ClockChoice } from "../../app/enums/clock-choice.js";
import { TimeFormatService } from "../../app/services/time-format.service.js";
import { TimeFormatsService } from "../../app/services/time-formats.service.js";
import { Resources } from "../../resources.js";

export class FakeTimeFormats {
  private readonly timePattern: WritableSignal<string> = signal(Resources.clockFormats[ClockChoice.TwelveHour][0]);
  private readonly dateTimePattern: WritableSignal<string> = signal(Resources.clockFormats[ClockChoice.TwelveHour][1]);

  public readonly time: Signal<string> = this.timePattern.asReadonly();
  public readonly dateTime: Signal<string> = this.dateTimePattern.asReadonly();
  public readonly provider: Provider = { provide: TimeFormatsService, useValue: this };
  public readonly service: TimeFormatService = Injector.create({ providers: [TimeFormatService, this.provider] }).get(TimeFormatService);

  public use(time: string, dateTime: string): void {
    this.timePattern.set(time);
    this.dateTimePattern.set(dateTime);
  }
}
