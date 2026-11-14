/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { FileGrant } from "@noldova/desktop.protocol";

import { Resources } from "../resources.js";

export class FileGrantRequest {
  public readonly module: string;
  public readonly lifetime: number;
  public readonly isMultiple: boolean;

  public constructor(module: string, lifetime: number, isMultiple: boolean) {
    this.module = module;
    this.lifetime = lifetime;
    this.isMultiple = isMultiple;
  }

  public static read(module: unknown, options: unknown): FileGrantRequest | null {
    if (!Object.isString(module) || !Resources.moduleIdPattern.test(module) || module === Resources.shellOwner)
      return null;
    try {
      const reader = JsonReader.fromValue(options);
      const lifetime = reader.hasField(Resources.lifetimeField) ? reader.readInteger(Resources.lifetimeField) : FileGrant.maximumLifetime;
      const isMultiple = reader.hasField(Resources.multipleField) && reader.readBoolean(Resources.multipleField);
      return lifetime > 0 && lifetime <= FileGrant.maximumLifetime ? new FileGrantRequest(module, lifetime, isMultiple) : null;
    }
    catch {
      return null;
    }
  }
}
