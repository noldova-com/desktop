/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";

import { type IToolSchemaValidator, PermissionCenter, ToolRegistry, ToolSchemaValidator } from "@noldova/desktop.runtime";

export class ToolRegistryFixture {
  public static readonly END_GRACE_MILLISECONDS: number = 50;

  public static create(permissions: PermissionCenter = new PermissionCenter(), schemas: IToolSchemaValidator = new ToolSchemaValidator(),
    createId: () => string = randomUUID): ToolRegistry {
    return new ToolRegistry(createId, schemas, permissions, ToolRegistryFixture.END_GRACE_MILLISECONDS);
  }
}
