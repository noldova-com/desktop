/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Migration } from "@noldova/desktop.runtime";

export class ModuleDatabaseFixture {
  public static readonly NOTES: Migration = new Migration("create-notes", ["CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT NOT NULL) STRICT"]);
}
