/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import { AuthenticodeCheck } from "../../src/noldova.desktop.build/src/services/packaging/authenticode-check.ts";
import { PackagedPublisherCheck } from "../../src/noldova.desktop.build/src/services/packaging/packaged-publisher-check.ts";
import { BuildException } from "../../src/noldova.desktop.build/src/exceptions/build.exception.ts";
import { ProcessResult } from "../../src/noldova.desktop.build/src/models/processes/process-result.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";
import { ScriptedRunner } from "./scripted-runner.ts";
import { SigningOutputCheckResources } from "./signing-output-check.resources.ts";

export class SigningOutputCheck implements ICheck {
  public readonly title: string = SigningOutputCheckResources.title;

  public async runAsync(output: Writable): Promise<boolean> {
    const findings = [...await SigningOutputCheck.checkAuthenticodeAsync(), ...await SigningOutputCheck.checkPackagedPublisherAsync()];
    for (const finding of findings)
      output.write(SigningOutputCheckResources.formatPrintedFinding(finding));
    output.write(SigningOutputCheckResources.checkedLine);
    return findings.length === 0;
  }

  private static async checkAuthenticodeAsync(): Promise<readonly string[]> {
    const findings: string[] = [];
    const passing = new ScriptedRunner(new ProcessResult(Resources.successExitCode, SigningOutputCheckResources.passingOutput, String.empty));
    await new AuthenticodeCheck(passing, tmpdir(), {}).verifyAsync([SigningOutputCheckResources.program], [], SigningOutputCheckResources.publisher);
    const call = passing.calls[0] ?? [];
    if (call.some(t => t.includes(SigningOutputCheckResources.publisher)))
      findings.push(SigningOutputCheckResources.publisherOnCommandLine);
    const script = Buffer.from(call.at(-1) ?? String.empty, SigningOutputCheckResources.scriptArgumentEncoding).toString(SigningOutputCheckResources.scriptEncoding).split(Resources.lineEnd);
    const changed = Array.from({ length: Math.max(script.length, SigningOutputCheckResources.pinnedScript.length) }, (_, t) => t).find(t => script[t] !== SigningOutputCheckResources.pinnedScript[t]);
    if (!Object.isUndefined(changed))
      findings.push(SigningOutputCheckResources.formatScriptChanged(changed + 1, script[changed]));

    const failing = new ScriptedRunner(new ProcessResult(Resources.successExitCode, SigningOutputCheckResources.failingOutput, String.empty));
    const message = await SigningOutputCheck.readFailureAsync(() => new AuthenticodeCheck(failing, tmpdir(), {})
      .verifyAsync([SigningOutputCheckResources.program], [], SigningOutputCheckResources.publisher));
    findings.push(...SigningOutputCheck.inspectFailure(SigningOutputCheckResources.authenticodeFailure, message));
    return findings;
  }

  private static async checkPackagedPublisherAsync(): Promise<readonly string[]> {
    const findings: string[] = [];
    const folder = await mkdtemp(path.join(tmpdir(), SigningOutputCheckResources.folderPrefix));
    try {
      for (const [name, product, publisher] of SigningOutputCheckResources.passCases) {
        const line = await PackagedPublisherCheck.verifyAsync(await SigningOutputCheck.writeArchiveAsync(folder, name, product), publisher);
        findings.push(...SigningOutputCheck.inspectText(SigningOutputCheckResources.formatPassSubject(name), line));
      }
      for (const [name, product, publisher] of SigningOutputCheckResources.failureCases) {
        const archive = await SigningOutputCheck.writeArchiveAsync(folder, name, product);
        const message = await SigningOutputCheck.readFailureAsync(() => PackagedPublisherCheck.verifyAsync(archive, publisher));
        findings.push(...SigningOutputCheck.inspectFailure(SigningOutputCheckResources.formatFailureSubject(name), message));
      }
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
    return findings;
  }

  private static async readFailureAsync(action: () => Promise<unknown>): Promise<string | null> {
    try {
      await action();
      return null;
    }
    catch (error) {
      if (!(error instanceof BuildException))
        throw error;
      return error.message;
    }
  }

  private static inspectFailure(subject: string, message: string | null): readonly string[] {
    if (Object.isNull(message))
      return [SigningOutputCheckResources.formatNotFailed(subject)];
    return [
      ...(message.includes(SigningOutputCheckResources.publisherVariable) ? [] : [SigningOutputCheckResources.formatUnnamed(subject, message)]),
      ...SigningOutputCheck.inspectText(subject, message)
    ];
  }

  private static inspectText(subject: string, text: string): readonly string[] {
    return [SigningOutputCheckResources.publisher, SigningOutputCheckResources.otherPublisher].some(t => text.includes(t)) ? [SigningOutputCheckResources.formatContainsPublisher(subject)] : [];
  }

  private static async writeArchiveAsync(folder: string, name: string, product: unknown): Promise<string> {
    const content = Buffer.from(JSON.stringify(product), Resources.encoding);
    const header = Buffer.from(JSON.stringify({
      files: { [SigningOutputCheckResources.productFolder]: { files: { [SigningOutputCheckResources.productFile]: { size: content.length, offset: SigningOutputCheckResources.contentOffset } } } }
    }), Resources.encoding);
    const padded = Math.ceil(header.length / SigningOutputCheckResources.archiveAlignment) * SigningOutputCheckResources.archiveAlignment;
    const pickle = Buffer.alloc(2 * SigningOutputCheckResources.archiveAlignment + padded);
    pickle.writeUInt32LE(SigningOutputCheckResources.archiveAlignment + padded, 0);
    pickle.writeUInt32LE(header.length, SigningOutputCheckResources.archiveAlignment);
    header.copy(pickle, 2 * SigningOutputCheckResources.archiveAlignment);
    const sizes = Buffer.alloc(2 * SigningOutputCheckResources.archiveAlignment);
    sizes.writeUInt32LE(SigningOutputCheckResources.archiveAlignment, 0);
    sizes.writeUInt32LE(pickle.length, SigningOutputCheckResources.archiveAlignment);
    const archive = path.join(folder, `${name.replaceAll(Resources.space, Resources.dash)}${SigningOutputCheckResources.archiveExtension}`);
    await writeFile(archive, Buffer.concat([sizes, pickle, content]));
    return archive;
  }
}
