/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { QualifiedName } from "@noldova/desktop.protocol";

export interface ISecretBackend {
  saveAsync(name: QualifiedName, value: string): Promise<void>;
  readAsync(name: QualifiedName): Promise<string | null>;
  removeAsync(name: QualifiedName): Promise<void>;
  isSetAsync(name: QualifiedName): Promise<boolean>;
}
