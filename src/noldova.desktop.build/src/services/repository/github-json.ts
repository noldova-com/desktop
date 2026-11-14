/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class GitHubJson {
  public static object(value: unknown, context: string): Readonly<Record<string, unknown>> {
    if (!Object.isPlainObject(value))
      throw new BuildException(Resources.formatJsonNotObject(context));
    return Object.fromEntries(Object.entries(value));
  }

  public static array(value: unknown, context: string): readonly unknown[] {
    if (!Array.isArray(value))
      throw new BuildException(Resources.formatJsonNotArray(context));
    return [...value];
  }

  public static child(source: Readonly<Record<string, unknown>>, key: string, context: string): Readonly<Record<string, unknown>> {
    return GitHubJson.object(source[key], Resources.formatJsonChildContext(context, key));
  }

  public static children(source: Readonly<Record<string, unknown>>, key: string, context: string): readonly Readonly<Record<string, unknown>>[] {
    return GitHubJson.array(source[key], Resources.formatJsonChildContext(context, key)).map((t, index) => GitHubJson.object(t, Resources.formatJsonItemContext(context, key, index)));
  }

  public static text(source: Readonly<Record<string, unknown>>, key: string, context: string): string {
    const value = source[key];
    if (!Object.isString(value))
      throw new BuildException(Resources.formatJsonNotText(context, key));
    return value;
  }

  public static nullableText(source: Readonly<Record<string, unknown>>, key: string, context: string): string | null {
    return Object.isNull(source[key]) ? null : GitHubJson.text(source, key, context);
  }

  public static number(source: Readonly<Record<string, unknown>>, key: string, context: string): number {
    const value = source[key];
    if (!Object.isNumber(value) || !Number.isInteger(value))
      throw new BuildException(Resources.formatJsonNotWholeNumber(context, key));
    return value;
  }

  public static flag(source: Readonly<Record<string, unknown>>, key: string, context: string): boolean {
    const value = source[key];
    if (!Object.isBoolean(value))
      throw new BuildException(Resources.formatJsonNotFlag(context, key));
    return value;
  }
}
