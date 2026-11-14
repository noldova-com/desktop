/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";

export class PackagedPath {
  public static unpacked(file: string): string {
    return file.replace(Resources.asarSegmentPattern, Resources.asarUnpackedReplacement);
  }
}
