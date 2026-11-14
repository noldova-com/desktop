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

import { BuildException } from "../../exceptions/build.exception.ts";
import type { IKilledCopySession } from "../../interfaces/i-killed-copy-session.ts";
import type { ISmokeCopy } from "../../interfaces/i-smoke-copy.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { RuntimeMountCheck } from "./runtime-mount-check.ts";
import { Resources } from "../../resources.ts";

export class MountedAppImage implements ISmokeCopy {
  public readonly items: readonly string[];
  private readonly mount: string;
  private readonly processes: string;
  private readonly runner: ProcessRunner;
  private readonly check: RuntimeMountCheck;

  private constructor(mount: string, processes: string, runner: ProcessRunner, readPublishedAsync: () => Promise<number | null>, output: Writable) {
    this.items = [mount];
    this.mount = mount;
    this.processes = processes;
    this.runner = runner;
    this.check = new RuntimeMountCheck(runner, () => MountedAppImage.readFuseMountsAsync(processes), readPublishedAsync, output);
  }

  public static async findAsync(processes: string, readLinkAsync: (link: string) => Promise<string>, runtime: number, runner: ProcessRunner, readPublishedAsync: () => Promise<number | null>, output: Writable):
    Promise<MountedAppImage> {
    const folder = path.join(processes, String(runtime));
    const program = await readLinkAsync(path.join(folder, Resources.procProgramLink));
    const input = await readLinkAsync(path.join(folder, ...Resources.procInputLinkSegments));
    const [mount] = (await MountedAppImage.readFuseMountsAsync(processes)).filter(t => program.startsWith(Resources.formatFolderPrefix(t))).sort((first, second) => second.length - first.length);
    if (Object.isUndefined(mount) || !input.startsWith(Resources.pipeLinkPrefix))
      throw new BuildException(Resources.formatSmokeNoMount(runtime, program, input));
    output.write(Resources.formatSmokeMounted(mount));
    return new MountedAppImage(mount, processes, runner, readPublishedAsync, output);
  }

  public async isPresentAsync(): Promise<boolean> {
    return (await MountedAppImage.readFuseMountsAsync(this.processes)).includes(this.mount);
  }

  public requireOutlivesAsync(runtime: number, moment: string): Promise<void> {
    return this.check.requireOutlivesAsync(this.mount, runtime, moment);
  }

  public async checkKilledAsync(session: IKilledCopySession): Promise<void> {
    const { installed, data, folder } = session;
    const log = path.join(folder, Resources.smokeKilledMainLogFile);
    const logs = [log, path.join(data, ...Resources.smokeDataLogSegments)];
    const mainProcess = await session.startMainProcessAsync(installed, data, folder, log);
    try {
      await session.waitForRuntimeAsync(installed, data, folder, mainProcess, logs);
      const runtime = await session.readRuntimeIdAsync(data);
      if (Object.isNull(runtime))
        throw new BuildException(Resources.formatSmokeDiscoveryNamesNoProcess(path.join(data, ...Resources.runtimeDiscoverySegments)));
      session.track(runtime);
      const copy = await session.requireCopyAsync(data, runtime, mainProcess, logs);
      mainProcess.signal(Resources.killSignal);
      if (!await mainProcess.waitAsync(Resources.smokeKillLimit))
        throw new BuildException(Resources.smokeMainStillRunning);
      await copy.requireOutlivesAsync(runtime, Resources.smokeMomentKilled);
      this.runner.kill(runtime);
      if (!await session.waitForExitAsync(runtime, Resources.smokeKillLimit))
        throw new BuildException(Resources.formatSmokeRuntimeStillRunning(runtime));
      session.track(null);
      await session.requireCopyEndedAsync(copy, Resources.smokeMomentKilled, path.join(data, ...Resources.smokeRuntimeLogSegments));
    }
    finally {
      if (!mainProcess.hasExited)
        mainProcess.signal(Resources.killSignal);
    }
  }

  private static async readFuseMountsAsync(processes: string): Promise<readonly string[]> {
    const lines = (await readFile(path.join(processes, ...Resources.mountTableSegments), Resources.textEncoding)).split(Resources.lineSeparator).filter(t => Resources.fuseMountPattern.test(t));
    return lines.map(t => t.split(Resources.mountFieldSeparator)[Resources.mountPointField] ?? String.empty).filter(t => t.length > 0);
  }
}
