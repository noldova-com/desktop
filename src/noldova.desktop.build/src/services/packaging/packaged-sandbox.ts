/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import type { IProcessRecord } from "../../interfaces/i-process-record.ts";
import type { IRetryClock } from "../../interfaces/i-retry-clock.ts";
import { Resources } from "../../resources.ts";

export class PackagedSandbox {
  private readonly processes: string;
  private readonly clock: IRetryClock;

  public constructor(processes: string, clock: IRetryClock) {
    this.processes = processes;
    this.clock = clock;
  }

  public async verifyAsync(started: number, isSandboxed: boolean): Promise<string> {
    const deadline = this.clock.now() + Resources.sandboxFilterWait;
    let family = PackagedSandbox.descend(await this.readAllAsync(), started);
    while (isSandboxed && PackagedSandbox.isFilterPending(family) && this.clock.now() < deadline) {
      await this.clock.pauseAsync(Resources.sandboxPause);
      family = PackagedSandbox.descend(await this.readAllAsync(), started);
    }
    const typed = family.filter(t => !Object.isNull(t.type));
    const parents = new Set(typed.map(t => t.parent));
    const [main, ...others] = family.filter(t => Object.isNull(t.type) && parents.has(t.id));
    if (Object.isUndefined(main) || others.length > 0)
      throw new BuildException(Resources.formatSandboxMainProcesses(started, others.length + (Object.isUndefined(main) ? 0 : 1),
        family.map(t => Resources.formatSandboxProcess(t.id, t.type ?? Resources.sandboxUntypedProcess))));
    const renderers = typed.filter(t => t.type === Resources.chromiumRendererType);
    if (renderers.length === 0)
      throw new BuildException(Resources.formatSandboxNoRenderer(main.id));
    const modes = Resources.formatSandboxModes(typed.map(t => [t.type, t.seccomp] as const));
    const isOff = main.arguments.includes(Resources.chromiumNoSandboxOption);
    if (isSandboxed) {
      if (isOff || renderers.some(t => t.seccomp !== Resources.seccompFilterMode))
        throw new BuildException(Resources.formatSandboxMustBeOn(main.id, isOff, modes));
      return Resources.formatSandboxOn(modes);
    }
    if (!isOff)
      throw new BuildException(Resources.formatSandboxMustBeOff(main.id, modes));
    return Resources.formatSandboxOff(modes);
  }

  private async readAllAsync(): Promise<readonly IProcessRecord[]> {
    const ids = (await readdir(this.processes)).filter(t => Resources.processIdPattern.test(t)).sort((first, second) => Number(first) - Number(second));
    const records = await Promise.all(ids.map(t => this.readAsync(t)));
    return records.filter(t => !Object.isNull(t));
  }

  private async readAsync(id: string): Promise<IProcessRecord | null> {
    try {
      const status = await readFile(path.join(this.processes, id, Resources.processStatusFile), Resources.textEncoding);
      const commandLine = await readFile(path.join(this.processes, id, Resources.processCommandLineFile), Resources.textEncoding);
      const processArguments = commandLine.split(Resources.processArgumentSeparator).filter(t => t.length > 0);
      const type = processArguments.find(t => t.startsWith(Resources.chromiumTypePrefix));
      return {
        id: Number(id),
        parent: Number(Resources.processParentLinePattern.exec(status)?.[1]),
        type: Object.isUndefined(type) ? null : type.slice(Resources.chromiumTypePrefix.length),
        seccomp: Number(Resources.processSeccompLinePattern.exec(status)?.[1]),
        arguments: processArguments
      };
    }
    catch (error) {
      if (error instanceof Error && Resources.errorCodeField in error && Resources.processEndedCodes.has(String(error[Resources.errorCodeField])))
        return null;
      throw error;
    }
  }

  private static isFilterPending(family: readonly IProcessRecord[]): boolean {
    return family.some(t => t.type === Resources.chromiumRendererType && t.seccomp !== Resources.seccompFilterMode);
  }

  private static descend(records: readonly IProcessRecord[], started: number): readonly IProcessRecord[] {
    const family = new Set([started]);
    let size = 0;
    while (size !== family.size) {
      size = family.size;
      for (const record of records)
        if (family.has(record.parent))
          family.add(record.id);
    }
    return records.filter(t => family.has(t.id));
  }
}
