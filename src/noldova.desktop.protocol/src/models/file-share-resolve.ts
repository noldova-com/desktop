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

export class FileShareResolve {
  private static readonly FIELDS: readonly string[] = [Resources.grantField];

  public readonly grant: string;

  public constructor(grant: string) {
    if (!Resources.grantPattern.test(grant))
      throw new ArgumentException(Resources.grantInvalid, Resources.grantField);

    this.grant = grant;
  }

  public static fromJson(value: unknown, path?: string): FileShareResolve {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, FileShareResolve.FIELDS);
    return WireContract.create(reader, () => new FileShareResolve(reader.readString(Resources.grantField)));
  }

  public toJson(): JsonObject {
    return { [Resources.grantField]: this.grant };
  }
}
