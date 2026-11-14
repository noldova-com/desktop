/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class FileGrantsDiscard {
  public static readonly maximumGrants: number = Resources.maximumDiscardedGrants;

  private static readonly FIELDS: readonly string[] = [Resources.grantsField];

  public readonly grants: readonly string[];

  public constructor(grants: readonly string[]) {
    if (grants.length === 0 || grants.length > FileGrantsDiscard.maximumGrants || new Set(grants).size !== grants.length)
      throw new ArgumentException(Resources.grantsInvalid, Resources.grantsField);
    if (grants.some(t => !Resources.grantPattern.test(t)))
      throw new ArgumentException(Resources.grantInvalid, Resources.grantsField);

    this.grants = [...grants];
  }

  public static fromJson(value: unknown, path?: string): FileGrantsDiscard {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, FileGrantsDiscard.FIELDS);
    return WireContract.create(reader, () => new FileGrantsDiscard(reader.readStringArray(Resources.grantsField)));
  }

  public toJson(): JsonObject {
    return { [Resources.grantsField]: [...this.grants] };
  }
}
