/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ComponentRef } from "@angular/core";

import { Fake } from "@noldova/desktop.protocol/testing";

import type { IWindowPalette } from "../../src/app/interfaces/i-window-palette";

export class FakeWindowPalette<T> extends Fake<IWindowPalette<T>> implements IWindowPalette<T> {
  public readonly close: IWindowPalette<T>["close"] = (...args) => this.tell("close", args, this.answers.close);

  public get componentRef(): ComponentRef<T> {
    return this.propertyOf("componentRef", this.answers.componentRef);
  }

  public get closed(): Promise<void> {
    return this.propertyOf("closed", this.answers.closed);
  }
}
