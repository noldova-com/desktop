/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RuntimeException } from "@noldova/desktop.runtime";

export class WaitHungException extends RuntimeException {
  public readonly seconds: number;
  public readonly failure: string;

  public constructor(seconds: number, failure: string) {
    super(`Waited ${seconds} seconds. ${failure}`);

    this.seconds = seconds;
    this.failure = failure;
  }
}
