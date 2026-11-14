/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ExitCodeUnreadableException } from "../../exceptions/exit-code-unreadable.exception.js";
import { ExitWaitTimedOutException } from "../../exceptions/exit-wait-timed-out.exception.js";
import { JobAssignmentFailedException } from "../../exceptions/job-assignment-failed.exception.js";
import { JobClosedBeforeExitException } from "../../exceptions/job-closed-before-exit.exception.js";
import type { IWindowsProcessApi } from "../../interfaces/i-windows-process-api.js";
import { Resources } from "../../resources.js";
import { ProcessSignals } from "./process-signals.js";

export class WindowsProcessJob {
  private readonly api: IWindowsProcessApi;
  private readonly handle: bigint;
  private readonly processId: number;
  private process: bigint | null = null;

  private constructor(api: IWindowsProcessApi, handle: bigint, processId: number) {
    this.api = api;
    this.handle = handle;
    this.processId = processId;
  }

  public static open(api: IWindowsProcessApi, processId: number, holdsDescendants: boolean): WindowsProcessJob {
    const job = new WindowsProcessJob(api, api.createJob(holdsDescendants), processId);
    try {
      const process = api.openProcess(processId, Resources.windowsJobAccess);
      if (Object.isNumber(process))
        throw new JobAssignmentFailedException(processId, process);
      job.process = process;
      const error = api.assignProcessToJob(job.handle, process);
      if (error !== 0 && !api.hasExited(process))
        throw new JobAssignmentFailedException(processId, error);
      return job;
    }
    catch (error) {
      job.close();
      throw error;
    }
  }

  public listProcessIds(): readonly number[] {
    return this.api.listJobProcesses(this.handle);
  }

  public async readExitCodeAsync(milliseconds: number): Promise<number> {
    const hasEnded = await ProcessSignals.waitAsync(() => Object.isNull(this.process) || this.api.hasExited(this.process), milliseconds);
    if (Object.isNull(this.process))
      throw new JobClosedBeforeExitException(this.processId);
    if (!hasEnded)
      throw new ExitWaitTimedOutException(this.processId, milliseconds);
    const code = this.api.readExitCode(this.process);
    if (Object.isNull(code))
      throw new ExitCodeUnreadableException(this.processId);
    return code;
  }

  public close(): void {
    if (!Object.isNull(this.process))
      this.api.closeHandle(this.process);
    this.process = null;
    this.api.closeHandle(this.handle);
  }
}
