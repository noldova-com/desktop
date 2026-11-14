/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";
import { WindowPartAccessException } from "./window-part-access.exception.js";

export class SearchSourceRegisteredException extends WindowPartAccessException {
  public override readonly name: string = "SearchSourceRegisteredException";
  public readonly source: string;

  public constructor(moduleId: string, source: string) {
    super(Resources.formatSearchSourceRegistered(source), moduleId);

    this.source = source;
  }
}
