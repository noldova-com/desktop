/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { DiscoveryFormatException } from "./discovery-format.exception.js";

export class DiscoveryVersionUnsupportedException extends DiscoveryFormatException {
  public readonly version: unknown;

  public constructor(version: unknown, options?: ExceptionOptions) {
    super(Resources.formatDiscoveryVersion(version), options);

    this.version = version;
  }
}
