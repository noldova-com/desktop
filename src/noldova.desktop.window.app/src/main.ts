/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowApplication } from "@noldova/desktop.window/build";

import { gallery } from "../../../_build/generated/gallery";
import { productAbout, productName, productTitleBar } from "../../../_build/generated/product";
import { moduleMenus, windowPartSources } from "../../../_build/generated/window-parts";

await WindowApplication.startAsync({ productName, about: productAbout, titleBar: productTitleBar, windowParts: windowPartSources, menus: moduleMenus, gallery });
