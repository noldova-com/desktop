/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";

export const installedElectron: typeof import("@noldova/desktop.electron") =
  await import(pathToFileURL(path.resolve("node_modules", "@noldova", "desktop.electron", "api", "index.js")).href);
