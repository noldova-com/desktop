/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RuntimeException } from "@noldova/desktop.runtime";

export class AppImageProgramNotStartedException extends RuntimeException {
  public readonly milliseconds: number;

  public constructor(milliseconds: number) {
    super(`The program in the fixture AppImage did not start within ${milliseconds} ms.`);

    this.milliseconds = milliseconds;
  }
}
