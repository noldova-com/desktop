/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";

import "@noldova/context.core";
import { StringBuilder } from "@noldova/context.text";

import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";
import { VersionFileCheck } from "./version-file-check.ts";

export class VersionFileCaseCheck implements ICheck {
  public readonly title: string = Resources.versionFileCaseCheckTitle;

  public async runAsync(output: Writable): Promise<boolean> {
    const findings: string[] = [];
    const folder = await mkdtemp(path.join(tmpdir(), Resources.versionFileCaseFolderPrefix));
    try {
      for (const [index, [name, versionFile, passes, line]] of Resources.versionFileCases.entries()) {
        const root = path.join(folder, String(index));
        await mkdir(root);
        await writeFile(path.join(root, Resources.manifestFile), Resources.versionFileCaseManifest);
        if (!Object.isNull(versionFile))
          await writeFile(path.join(root, Resources.versionFile), versionFile);
        const text = new StringBuilder();
        const collected = new Writable({ write: (chunk, _encoding, done): void => { text.append(String(chunk)); done(); } });
        try {
          const passed = await new VersionFileCheck(root).runAsync(collected);
          if (passed !== passes)
            findings.push(Resources.formatVersionFileCaseWrongResult(passed, name, passes, text.toString().trim()));
          else if (!text.toString().includes(line))
            findings.push(Resources.formatVersionFileCaseMissingLine(name, line, text.toString().trim()));
        }
        catch (error) {
          findings.push(Resources.formatVersionFileCaseThrew(name, error instanceof Error ? error.message : String(error)));
        }
      }
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    if (findings.length === 0)
      output.write(Resources.formatVersionFileCaseAllPassed(Resources.versionFileCases.length));
    return findings.length === 0;
  }
}
