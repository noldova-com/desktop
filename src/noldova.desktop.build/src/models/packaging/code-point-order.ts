/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.ts";

export class CodePointOrder {
  public static compare(left: string, right: string): number {
    return Buffer.compare(Buffer.from(left, Resources.textEncoding), Buffer.from(right, Resources.textEncoding));
  }
}
