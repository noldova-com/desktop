/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../../../resources.js";
import { Tab } from "./tab.js";
import type { ViewRegistry } from "./view-registry.js";

export class ViewTab extends Tab {
  public constructor(name: string, instance?: string) {
    super(Resources.viewField, name, instance);
  }

  public override get isMovable(): boolean {
    return true;
  }

  public override get leadsSpinner(): boolean {
    return false;
  }

  public override isAvailable(registry: ViewRegistry): boolean {
    return registry.hasView(this.name);
  }

  public override isRenamable(registry: ViewRegistry): boolean {
    return registry.isRenamableView(this.name);
  }

  public override toJson(): JsonObject {
    return Object.isUndefined(this.instance)
      ? { [Resources.viewField]: this.name }
      : { [Resources.viewField]: this.name, [Resources.instanceField]: this.instance };
  }
}
