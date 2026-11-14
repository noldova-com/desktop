/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class AgentControlState {
  private static readonly FIELDS: readonly string[] = [Resources.isStoppedField, Resources.isActingField];

  public readonly isStopped: boolean;
  public readonly isActing: boolean;

  public constructor(isStopped: boolean, isActing: boolean) {
    this.isStopped = isStopped;
    this.isActing = isActing;
  }

  public static fromJson(value: unknown, path?: string): AgentControlState {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, AgentControlState.FIELDS);
    return new AgentControlState(reader.readBoolean(Resources.isStoppedField), reader.readBoolean(Resources.isActingField));
  }

  public toJson(): JsonObject {
    return { [Resources.isStoppedField]: this.isStopped, [Resources.isActingField]: this.isActing };
  }
}
