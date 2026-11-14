/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { ImportClosure } from "../../src/noldova.desktop.build/src/services/packages/import-closure.ts";
import { SourceScanner } from "../../src/noldova.desktop.build/src/services/structure/source-scanner.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class ReleaseScriptCheck implements ICheck {
  private readonly root: string;

  public readonly title: string = Resources.releaseScriptCheckTitle;

  public constructor(root: string) {
    this.root = root;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const closure = new ImportClosure(this.root);
    const declared = JsonReader.parse(await readFile(path.join(this.root, Resources.releaseScriptManifest), Resources.encoding)).toJson()[Resources.releaseScriptPeerField];
    const peers = Object.isObject(declared) ? Object.keys(declared).filter(t => t.startsWith(Resources.releaseScriptPeerPrefix)) : [];
    const findings: string[] = [];
    let checked = 0;
    for (const file of await closure.listAsync(path.join(this.root, Resources.releaseScriptEntry))) {
      checked++;
      const relative = path.relative(this.root, file).split(path.sep).join(path.posix.sep);
      for (const literal of new SourceScanner(await readFile(file, Resources.encoding)).scan().imports)
        if (!literal.value.startsWith(Resources.relativeImportPrefix) && !literal.value.startsWith(Resources.builtInImportPrefix) && !peers.includes(literal.value))
          findings.push(Resources.formatReleaseScriptFinding(relative, literal.value, peers));
    }
    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.formatReleaseScriptChecked(checked));
    return findings.length === 0;
  }
}
