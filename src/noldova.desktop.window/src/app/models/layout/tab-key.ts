/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../../resources.js";
import { DocumentTab } from "./document-tab.js";
import { Tab } from "./tab.js";
import { ViewTab } from "./view-tab.js";

export class TabKey {
  public static parse(key: string): Tab | null {
    const [kind, name = String.empty, ...rest] = key.split(Resources.keySeparator);
    const instance = rest.length === 0 ? undefined : rest.join(Resources.keySeparator);
    if (!Tab.isName(name) || !Tab.isInstance(instance))
      return null;
    return kind === Resources.viewField ? new ViewTab(name, instance) : kind === Resources.documentField ? new DocumentTab(name, instance) : null;
  }
}
