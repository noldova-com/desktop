/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { QualifiedName } from "@noldova/desktop.protocol";

import { Resources } from "../../resources.js";
import type { ShellDatabase } from "../database/shell-database.js";

export class SecretTable {
  private readonly database: ShellDatabase;

  public constructor(database: ShellDatabase) {
    this.database = database;
  }

  public save(device: string, name: QualifiedName, ciphertext: string): void {
    this.database.run(Resources.saveSecretStatement, device, name.owner, name.member, ciphertext);
  }

  public read(device: string, name: QualifiedName): string | null {
    const row = this.database.read(Resources.readSecretStatement, device, name.owner, name.member);
    return Object.isUndefined(row) ? null : String(row[Resources.valueColumn]);
  }

  public remove(device: string, name: QualifiedName): void {
    this.database.run(Resources.removeSecretStatement, device, name.owner, name.member);
  }
}
