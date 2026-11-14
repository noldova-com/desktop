/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { NegativeCountException } from "./negative-count.exception.ts";
import { TotalsUnreadableException } from "./totals-unreadable.exception.ts";

export class JsonFields {
  private readonly reader: JsonReader;
  private readonly source: string;

  public constructor(reader: JsonReader, source: string) {
    this.reader = reader;
    this.source = source;
  }

  public static parse(text: string, source: string): JsonFields {
    return JsonFields.read(source, () => new JsonFields(JsonReader.parse(text), source));
  }

  public static fromValue(value: unknown, source: string): JsonFields {
    return JsonFields.read(source, () => new JsonFields(JsonReader.fromValue(value), source));
  }

  public count(name: string): number {
    const value = JsonFields.read(this.source, () => this.reader.readInteger(name));
    if (value < 0)
      throw new NegativeCountException(this.source, this.reader.path, name);
    return value;
  }

  public number(name: string): number {
    return JsonFields.read(this.source, () => this.reader.readNumber(name));
  }

  public text(name: string): string {
    return JsonFields.read(this.source, () => this.reader.readString(name));
  }

  public texts(name: string): readonly string[] {
    return JsonFields.read(this.source, () => this.reader.readStringArray(name));
  }

  public objects(name: string): readonly JsonFields[] {
    return JsonFields.read(this.source, () => this.reader.readObjectArray(name)).map(t => new JsonFields(t, this.source));
  }

  public object(name: string): JsonFields {
    return new JsonFields(JsonFields.read(this.source, () => this.reader.readObject(name)), this.source);
  }

  public has(name: string): boolean {
    return this.reader.hasField(name) && !Object.isNull(this.reader.readValue(name));
  }

  private static read<T>(source: string, read: () => T): T {
    try {
      return read();
    }
    catch (error) {
      throw new TotalsUnreadableException(source, error);
    }
  }
}
