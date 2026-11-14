/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { access } from "node:fs/promises";

export class FilePresence {
  public static existsAsync(path: string): Promise<boolean> {
    return access(path).then(() => true, () => false);
  }
}
