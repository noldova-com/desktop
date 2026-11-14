/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import { IssuedFileGrant } from "../models/issued-file-grant.js";
import { IssuedFileGrants } from "../models/issued-file-grants.js";

export class IssuedFileGrantsReader {
  public static read(value: unknown): IssuedFileGrants {
    if (Object.isNull(value))
      return IssuedFileGrants.none;
    const reader = JsonReader.fromValue(value);
    return new IssuedFileGrants(reader.readObjectArray(Resources.grantedField).map(t => IssuedFileGrantsReader.readGrant(t)),
      reader.readStringArray(Resources.refusedField));
  }

  private static readGrant(reader: JsonReader): IssuedFileGrant {
    return new IssuedFileGrant(reader.readString(Resources.grantField), reader.readString(Resources.nameField), reader.readString(Resources.mediaTypeField),
      reader.readInteger(Resources.sizeField));
  }
}
