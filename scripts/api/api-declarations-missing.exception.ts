/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ApiException } from "./api.exception.ts";

export class ApiDeclarationsMissingException extends ApiException {
  public readonly declarations: string;
  public readonly isInstalled: boolean;

  public constructor(declarations: string, isInstalled: boolean) {
    super(isInstalled ? Resources.formatApiNoInstalledDeclarations(declarations) : Resources.formatApiNoDeclarations(declarations));

    this.declarations = declarations;
    this.isInstalled = isInstalled;
  }
}
