/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { addAbortListener, once } from "node:events";

import { ExceptionOptions } from "@noldova/context.exceptions";

import { ProcessStartFailedException } from "../../src/exceptions/process-start-failed.exception.js";
import type { IRuntimePartContext } from "../../src/interfaces/i-runtime-part-context.js";
import { OwnedProcess } from "../../src/models/owned-process.js";
import { ProcessExit } from "../../src/models/process-exit.js";
import type { ProcessLaunch } from "../../src/models/process-launch.js";
import type { ProcessRequest } from "../../src/models/process-request.js";
import { ProcessEnvironment } from "../../src/services/process/process-environment.js";
import { ProgramLaunchResolver } from "../../src/services/process/program-launch-resolver.js";
import { ProgramLocator } from "../../src/services/process/program-locator.js";

export class StartedProgramsFixture {
  private static readonly WINDOWS: string = "win32";
  private static readonly PIPED: "pipe" = "pipe";
  private static readonly SPAWN_EVENT: string = "spawn";
  private static readonly EXIT_EVENT: string = "exit";
  private static readonly ERROR_EVENT: string = "error";
  private static readonly KILL_SIGNAL: NodeJS.Signals = "SIGKILL";

  private readonly started: ChildProcessWithoutNullStreams[] = [];
  private readonly locator: ProgramLocator = new ProgramLocator(process.platform);
  private readonly resolver: ProgramLaunchResolver = new ProgramLaunchResolver(process.platform, process.env);

  public readonly startProcessAsync: IRuntimePartContext["startProcessAsync"] = request => this.startAsync(request);

  public get children(): readonly ChildProcessWithoutNullStreams[] {
    return this.started;
  }

  public get running(): readonly ChildProcessWithoutNullStreams[] {
    return this.started.filter(t => Object.isNull(t.exitCode) && Object.isNull(t.signalCode));
  }

  private static spawn(program: string, launch: ProcessLaunch, workingFolder: string, environment: NodeJS.ProcessEnv): ChildProcessWithoutNullStreams {
    try {
      return spawn(launch.executable, [...launch.arguments], {
        cwd: workingFolder,
        env: environment,
        stdio: StartedProgramsFixture.PIPED,
        windowsHide: true,
        detached: process.platform !== StartedProgramsFixture.WINDOWS,
        argv0: launch.programArgument,
        windowsVerbatimArguments: launch.isVerbatim
      });
    }
    catch (error) {
      throw new ProcessStartFailedException(program, new ExceptionOptions(error));
    }
  }

  private async startAsync(request: ProcessRequest): Promise<OwnedProcess> {
    request.signal?.throwIfAborted();
    const environment = ProcessEnvironment.create(process.platform, process.env, request);
    const program = await this.locator.locateAsync(request.program, environment);
    const launch = await this.resolver.resolveAsync(program, request.arguments, environment, request.isVerbatim);
    const child = StartedProgramsFixture.spawn(program, launch, request.workingFolder, environment.values);
    const exited = new Promise<ProcessExit>(resolve =>
      child.once(StartedProgramsFixture.EXIT_EVENT, (code: number | null, signal: NodeJS.Signals | null) => resolve(new ProcessExit(code, signal))));
    try {
      await once(child, StartedProgramsFixture.SPAWN_EVENT);
    }
    catch (error) {
      throw new ProcessStartFailedException(program, new ExceptionOptions(error));
    }

    child.stdin.on(StartedProgramsFixture.ERROR_EVENT, () => undefined);
    this.started.push(child);
    const owned = new OwnedProcess(child, program, new Date(), exited, async () => {
      child.kill(StartedProgramsFixture.KILL_SIGNAL);
      await exited;
    });
    if (!Object.isUndefined(request.signal)) {
      const listener = addAbortListener(request.signal, () => void owned.stopAsync());
      void exited.then(() => listener[Symbol.dispose]());
    }
    return owned;
  }
}
