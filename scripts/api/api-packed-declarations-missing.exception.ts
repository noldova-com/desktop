/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ApiException } from "./api.exception.ts";

export class ApiPackedDeclarationsMissingException extends ApiException {
  public readonly packed: string;

  public constructor(packed: string) {
    super(Resources.formatApiNoPackedDeclarations(packed));

    this.packed = packed;
  }
}
