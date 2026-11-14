/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert } from "@noldova/context.testing";

export class PreloadArgumentFixture {
  public static readonly PREFIX: string = "--desktop-preload=";

  public static read(values: readonly string[] | undefined): JsonReader {
    Assert.isDefined(values);
    Assert.areEqual(1, values.length);
    const argument = values[0] ?? String.empty;
    Assert.isTrue(argument.startsWith(PreloadArgumentFixture.PREFIX), argument);
    return JsonReader.parse(argument.slice(PreloadArgumentFixture.PREFIX.length));
  }

  public static readAppearance(values: readonly string[] | undefined): string {
    return JSON.stringify(PreloadArgumentFixture.read(values).readValue("appearance"));
  }
}
