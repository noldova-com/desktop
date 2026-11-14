/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { InjectionToken } from "@angular/core";

import type { IProductAbout } from "../interfaces/i-product-about.js";
import type { MenuDeclarations } from "./menu-declarations.js";
import type { WindowPartSource } from "./window-part-source.js";
import { Resources } from "../../resources.js";

export class BuildTokens {
  public static readonly noAbout: IProductAbout = { description: null, website: null, releases: null, licenses: null, logo: null };
  public static readonly sources: InjectionToken<readonly WindowPartSource[]> = new InjectionToken<readonly WindowPartSource[]>(
    Resources.windowPartSourcesToken,
    { providedIn: "root", factory: () => [] });
  public static readonly menus: InjectionToken<readonly MenuDeclarations[]> = new InjectionToken<readonly MenuDeclarations[]>(
    Resources.windowPartMenusToken,
    { providedIn: "root", factory: () => [] });
  public static readonly about: InjectionToken<IProductAbout> = new InjectionToken<IProductAbout>(
    Resources.productAboutToken,
    { providedIn: "root", factory: () => BuildTokens.noAbout });
}
