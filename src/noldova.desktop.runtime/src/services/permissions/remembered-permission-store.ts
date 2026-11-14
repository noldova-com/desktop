/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import type { SQLOutputValue } from "node:sqlite";

import "@noldova/context.core";

import type { PermissionDecision } from "../../enums/permission-decision.js";
import { RememberedPermission } from "../../models/remembered-permission.js";
import { Resources } from "../../resources.js";
import type { ShellDatabase } from "../database/shell-database.js";

export class RememberedPermissionStore {
  private readonly database: ShellDatabase;
  private readonly createId: () => string;
  private readonly now: () => Date;

  public constructor(database: ShellDatabase, createId: () => string = randomUUID, now: () => Date = () => new Date()) {
    this.database = database;
    this.createId = createId;
    this.now = now;
  }

  public find(module: string, action: string, subject: string | null, scope: string): PermissionDecision | null {
    const row = this.database.read(Resources.findRememberedPermissionStatement, module, action, subject, scope);
    const decision = row?.[Resources.decisionColumn];
    return Resources.rememberedDecisions.find(t => t === decision) ?? null;
  }

  public remember(module: string, action: string, subject: string | null, scope: string, decision: PermissionDecision): void {
    this.database.transaction(() => {
      this.database.run(Resources.forgetMatchingPermissionsStatement, module, action, subject, scope);
      this.database.run(Resources.rememberPermissionStatement, this.createId(), module, action, subject, scope, decision, this.now().getTime());
    });
  }

  public list(): readonly RememberedPermission[] {
    return this.database.readAll(Resources.listRememberedPermissionsStatement).flatMap(t => RememberedPermissionStore.read(t));
  }

  public forget(id: string): RememberedPermission | null {
    return this.database.transaction(() => {
      const row = this.database.read(Resources.readRememberedPermissionStatement, id);
      if (Object.isUndefined(row))
        return null;
      this.database.run(Resources.forgetRememberedPermissionStatement, id);
      return RememberedPermissionStore.read(row)[0] ?? null;
    });
  }

  private static read(row: Record<string, SQLOutputValue>): RememberedPermission[] {
    const decision = Resources.rememberedDecisions.find(t => t === row[Resources.decisionColumn]);
    const subject = row[Resources.subjectColumn];
    if (Object.isUndefined(decision))
      return [];
    return [new RememberedPermission(
      String(row[Resources.idColumn]), String(row[Resources.moduleColumn]), String(row[Resources.actionColumn]), Object.isNull(subject) ? null : String(subject),
      String(row[Resources.scopeColumn]), decision, new Date(Number(row[Resources.rememberedColumn])))];
  }
}
