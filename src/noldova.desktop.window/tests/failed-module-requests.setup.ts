/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { commands } from "vitest/browser";

declare module "vitest/browser" {
  interface BrowserCommands {
    watchFailedModuleRequests: () => Promise<readonly string[]>;
  }
}

await commands.watchFailedModuleRequests();
