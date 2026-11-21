/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PackageManifest } from "../../src/noldova.desktop.build/src/models/packages/package-manifest.ts";
import type { TestProcessPart } from "./test-process-part.ts";

export class TestedPackage {
  public readonly manifest: PackageManifest;
  public readonly part: TestProcessPart;

  public constructor(manifest: PackageManifest, part: TestProcessPart) {
    this.manifest = manifest;
    this.part = part;
  }
}
