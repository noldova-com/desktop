/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import path from "node:path";
import type { Writable } from "node:stream";

import { ClassFieldsReader } from "../structure/class-fields.reader.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class PreloadArgumentCheck implements ICheck {
  public readonly title: string = Resources.preloadArgumentCheckTitle;

  public async runAsync(output: Writable): Promise<boolean> {
    const preload = (await ClassFieldsReader.readAsync(path.join(import.meta.dirname, Resources.checksToRepositoryRoot, Resources.preloadArgumentPreloadFile))).readText(Resources.preloadArgumentPreloadField);
    const owned = (await ClassFieldsReader.readAsync(path.join(import.meta.dirname, Resources.checksToRepositoryRoot, Resources.preloadArgumentResourcesFile))).readText(Resources.preloadArgumentResourcesField);
    const findings = Object.isNull(preload) || Object.isNull(owned)
      ? [Resources.preloadArgumentNotText]
      : preload === owned ? []
        : [Resources.formatPreloadArgumentDiffering(preload, owned)];
    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.preloadArgumentChecked);
    return findings.length === 0;
  }
}
