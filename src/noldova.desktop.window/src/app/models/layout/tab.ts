/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../../../resources.js";
import type { ViewRegistry } from "./view-registry.js";

export abstract class Tab {
  public readonly name: string;
  public readonly instance: string | undefined;
  public readonly key: string;

  protected constructor(kind: string, name: string, instance?: string) {
    if (!Tab.isName(name))
      throw new ArgumentException(Resources.invalidContributionName, Resources.nameParameterName);
    if (!Tab.isInstance(instance))
      throw new ArgumentException(Resources.invalidInstance, Resources.instanceParameterName);

    this.name = name;
    this.instance = instance;
    this.key = [kind, name, ...(Object.isUndefined(instance) ? [] : [instance])].join(Resources.keySeparator);
  }

  public abstract get isMovable(): boolean;

  public abstract get leadsSpinner(): boolean;

  public static isName(name: string): boolean {
    return Resources.contributionNamePattern.test(name);
  }

  public static isInstance(instance: string | undefined): boolean {
    return Object.isUndefined(instance) || !String.isNullOrWhitespace(instance);
  }

  public equals(other: Tab | null): boolean {
    return other?.key === this.key;
  }

  public abstract isAvailable(registry: ViewRegistry): boolean;

  public abstract isRenamable(registry: ViewRegistry): boolean;

  public abstract toJson(): JsonObject;
}
