/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RuntimeException } from "@noldova/desktop.runtime";

export class HostDiscoveryMissingException extends RuntimeException {
  public constructor() {
    super("The host has published no discovery metadata.");
  }
}
