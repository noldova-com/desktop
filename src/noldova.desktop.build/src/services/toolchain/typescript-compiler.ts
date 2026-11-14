/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createRequire } from "node:module";
import path from "node:path";

import { Resources } from "../../resources.ts";

export class TypeScriptCompiler {
  public static locate(root: string): string {
    return path.join(path.dirname(createRequire(path.join(root, Resources.packageManifestFileName)).resolve(Resources.typeScriptManifestPath)), Resources.typeScriptCompilerPath);
  }
}
