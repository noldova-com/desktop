/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonException, JsonReader } from "@noldova/context.json";

export class SmokeAnswer {
  public static read<T>(text: string, read: (reader: JsonReader) => T): T | null {
    try {
      return read(JsonReader.parse(text));
    }
    catch (error) {
      if (error instanceof JsonException)
        return null;
      throw error;
    }
  }
}
