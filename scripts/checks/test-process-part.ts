/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { TestPartsException } from "./test-parts.exception.ts";

export class TestProcessPart {
  public readonly name: string;
  public readonly paths: readonly string[];
  public readonly isExcept: boolean;

  public constructor(name: string, paths: readonly string[] = [], isExcept: boolean = false) {
    this.name = name;
    this.paths = paths;
    this.isExcept = isExcept;
  }

  public static parseAll(text: string | undefined): TestProcessPart[] {
    if (Object.isUndefined(text))
      return [];
    let value: unknown;
    try {
      value = JSON.parse(text);
    }
    catch (error) {
      throw new TestPartsException(text, error);
    }
    if (!Array.isArray(value))
      throw new TestPartsException(text);
    let parts: TestProcessPart[];
    try {
      parts = value.map((t: unknown, i) => TestProcessPart.read(JsonReader.fromValue(t, Resources.formatJsonArrayItemPath(i))));
    }
    catch (error) {
      throw new TestPartsException(text, error);
    }
    if (parts.some(t => t.paths.some(u => u.length === 0)))
      throw new TestPartsException(text);
    return parts;
  }

  public static selects(parts: readonly TestProcessPart[], packageName: string, filePath: string): boolean {
    const part = parts.find(t => t.name === packageName);
    return Object.isUndefined(part) || part.includes(filePath);
  }

  public format(): string {
    if (this.paths.length === 0)
      return this.name;
    return Resources.formatTestProcessPart(this.name, this.paths, this.isExcept);
  }

  public includes(filePath: string): boolean {
    if (this.paths.length === 0)
      return true;
    return this.paths.some(t => TestProcessPart.matches(filePath, t)) !== this.isExcept;
  }

  public findUnmatched(filePaths: readonly string[]): string[] {
    return this.paths.filter(t => !filePaths.some(u => TestProcessPart.matches(u, t)));
  }

  public toJSON(): object {
    return { name: this.name, paths: this.paths, isExcept: this.isExcept };
  }

  private static read(part: JsonReader): TestProcessPart {
    return new TestProcessPart(part.readString(Resources.nameField), part.readStringArray(Resources.testProcessPartPathsField), part.readBoolean(Resources.testProcessPartIsExceptField));
  }

  private static matches(filePath: string, part: string): boolean {
    const file = filePath.replace(Resources.testProcessPartWindowsSeparator, Resources.pathSeparator);
    return file === part || file.startsWith(`${part}${Resources.pathSeparator}`);
  }
}
