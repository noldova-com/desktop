/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class ShellClients {
  public static readonly mainProcess: string = Resources.mainClient;
  public static readonly commandLine: string = Resources.commandLineClient;
}
