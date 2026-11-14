/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AppWindow } from "@noldova/desktop.protocol";

export interface IAppWindows {
  list(): readonly AppWindow[];

  onChanged(listener: () => void): () => void;
}
