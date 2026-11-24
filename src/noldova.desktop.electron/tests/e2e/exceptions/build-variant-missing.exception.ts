/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class BuildVariantMissingException extends ElectronException {
  public readonly name: string;
  public readonly variant: string;

  public constructor(name: string, variant: string) {
    super(`The build variant ${name} is missing; build it with npm run build -- --test --without <module id> --output ${variant}.`);

    this.name = name;
    this.variant = variant;
  }
}
