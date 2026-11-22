/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SecretTable } from "../services/secrets/secret-table.js";

export class SecretStore {
  public readonly table: SecretTable;
  public readonly device: string;

  public constructor(table: SecretTable, device: string) {
    this.table = table;
    this.device = device;
  }
}
