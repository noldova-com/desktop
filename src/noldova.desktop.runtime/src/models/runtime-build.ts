/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BuildIdentity } from "@noldova/desktop.protocol";

import { ProductInfo } from "./product-info.js";

export class RuntimeBuild {
  private static built: BuildIdentity | null = null;

  public static get identity(): BuildIdentity {
    RuntimeBuild.built ??= new BuildIdentity(ProductInfo.current.version, BuildIdentity.supportedProtocolVersion, ProductInfo.current.build);
    return RuntimeBuild.built;
  }
}
