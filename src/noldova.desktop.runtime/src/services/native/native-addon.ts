/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import { AddonIncompleteException } from "../../exceptions/addon-incomplete.exception.js";
import { AddonLoadFailedException } from "../../exceptions/addon-load-failed.exception.js";
import { AddonMissingException } from "../../exceptions/addon-missing.exception.js";
import { AddonUnexpectedValueException } from "../../exceptions/addon-unexpected-value.exception.js";
import { Resources } from "../../resources.js";

export class NativeAddon<T extends object> {
  private readonly file: string;
  private readonly functions: readonly string[];
  private addon: T | null = null;

  public constructor(file: string, functions: readonly (keyof T & string)[]) {
    this.file = file;
    this.functions = [...functions];
  }

  public get name(): string {
    return Resources.formatRelativePath(this.target, path.basename(this.file));
  }

  public static locate(name: string, platform: string = process.platform, architecture: string = process.arch): string {
    return fileURLToPath(new URL(Resources.formatAddonUrl(platform, architecture, name), import.meta.url));
  }

  public load(): T {
    if (!Object.isNull(this.addon))
      return this.addon;
    if (!existsSync(this.file))
      throw new AddonMissingException(this.target, path.basename(this.file));
    let addon: unknown;
    try {
      addon = createRequire(import.meta.url)(this.file);
    }
    catch (error) {
      throw new AddonLoadFailedException(this.name, new ExceptionOptions(error));
    }
    if (!this.isComplete(addon))
      throw new AddonIncompleteException(this.name);
    this.addon = addon;
    return addon;
  }

  public expect<U>(value: unknown, isExpected: (value: unknown) => value is U): U {
    if (!isExpected(value))
      throw new AddonUnexpectedValueException(this.name);
    return value;
  }

  private get target(): string {
    return path.basename(path.dirname(this.file));
  }

  private isComplete(addon: unknown): addon is T {
    if (!Object.isObject(addon))
      return false;
    const exported = new Map(Object.entries(addon));
    return this.functions.every(t => Object.isFunction(exported.get(t)));
  }
}
