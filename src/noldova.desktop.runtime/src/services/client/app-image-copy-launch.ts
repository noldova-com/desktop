/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { close } from "node:fs";
import { appendFile, mkdtemp, open, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import type { UpdateProcess } from "@noldova/desktop.protocol";

import { AppImageCopyUnlistedException } from "../../exceptions/app-image-copy-unlisted.exception.js";
import { LaunchStartFailedException } from "../../exceptions/launch-start-failed.exception.js";
import type { IPosixProcessApi } from "../../interfaces/i-posix-process-api.js";
import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import { AppImageCopyRecord } from "../../models/app-image-copy-record.js";
import type { AppImageSource } from "../../models/app-image-source.js";
import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";
import { FolderWatch } from "../files/folder-watch.js";
import type { ProcessPresence } from "../installation/process-presence.js";

export class AppImageCopyLaunch {
  private static readonly closeDescriptorAsync: typeof close.__promisify__ = promisify(close);

  private readonly starter: IProcessStarter;
  private readonly posix: IPosixProcessApi;
  private readonly presence: ProcessPresence;
  private readonly openKeepalive: (processId: number) => number | null;
  private readonly extractAsync: (image: string, extraction: string, environment: NodeJS.ProcessEnv, startLog: string) => Promise<string>;
  private readonly log: (text: string) => void;
  private readonly mountWait: number;

  public constructor(starter: IProcessStarter, posix: IPosixProcessApi, presence: ProcessPresence, openKeepalive: (processId: number) => number | null,
    extractAsync: (image: string, extraction: string, environment: NodeJS.ProcessEnv, startLog: string) => Promise<string>, log: (text: string) => void,
    mountWait: number = Resources.copyMountWait) {
    this.starter = starter;
    this.posix = posix;
    this.presence = presence;
    this.openKeepalive = openKeepalive;
    this.extractAsync = extractAsync;
    this.log = log;
    this.mountWait = mountWait;
  }

  public static findTemporaryFolder(environment: NodeJS.ProcessEnv): string {
    return [environment[Resources.temporaryFolderVariable], environment[Resources.temporaryVariable], environment[Resources.tempVariable]]
      .find(t => !Object.isUndefined(t) && t.length > 0) ?? Resources.defaultTemporaryFolder;
  }

  public async startAsync(source: AppImageSource, executablePath: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv,
    startLog: string, record: string): Promise<number> {
    const mounted = await source.isMountedAsync() ? await this.mountAsync(source.file, environment, startLog, record) : null;
    if (Object.isNull(mounted))
      return this.startExtractedAsync(source, executablePath, launchArguments, environment, startLog, record);
    const [mounter, folder, keepalive] = mounted;
    try {
      return await this.startHeldAsync(AppImageCopyLaunch.mover(source, folder), executablePath, launchArguments, { ...environment, [Resources.appImageFolderVariable]: folder },
        startLog, keepalive);
    }
    finally {
      await AppImageCopyLaunch.closeDescriptorAsync(keepalive);
      AppImageCopyLaunch.signal(mounter, Resources.copyEndSignal);
      await rm(record, { force: true });
    }
  }

  private static mover(source: AppImageSource, folder: string): (value: string) => string {
    return value => value.startsWith(Resources.formatFolderPrefix(source.folder)) ? `${folder}${value.slice(source.folder.length)}` : value;
  }

  private static listEntries(environment: NodeJS.ProcessEnv): string[] {
    return Object.entries(environment).flatMap(([name, value]) => Object.isUndefined(value) ? [] : [`${name}${Resources.environmentEntrySeparator}${value}`]);
  }

  private static signal(processId: number, signal: NodeJS.Signals | 0): boolean {
    try {
      process.kill(processId, signal);
      return true;
    }
    catch (error) {
      if (!SystemErrorCode.is(error, Resources.missingProcessCode))
        throw error;
      return false;
    }
  }

  private static hasEnded(processId: number): boolean {
    return !AppImageCopyLaunch.signal(processId, 0);
  }

  private async startHeldAsync(move: (value: string) => string, executablePath: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv,
    startLog: string, keepalive: number): Promise<number> {
    const program = move(executablePath);
    const errors = await open(startLog, Resources.appendFlag, Resources.privateFileMode);
    try {
      return this.posix.startDetached(program, launchArguments.map(move), AppImageCopyLaunch.listEntries(environment), errors.fd, undefined, undefined, keepalive);
    }
    catch (error) {
      throw new LaunchStartFailedException(program, new ExceptionOptions(error));
    }
    finally {
      await errors.close();
    }
  }

  private async startExtractedAsync(source: AppImageSource, executablePath: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv,
    startLog: string, record: string): Promise<number> {
    const holder = await this.stampAsync(process.pid, Resources.copyLauncherRole);
    const extraction = await mkdtemp(path.join(AppImageCopyLaunch.findTemporaryFolder(environment), Resources.copyExtractionPrefix));
    const processId = await this.runExtractedAsync(source, holder, extraction, executablePath, launchArguments, environment, startLog, record)
      .catch(async (error: unknown) => {
        await rm(extraction, { recursive: true, force: true });
        await rm(record, { force: true });
        throw error;
      });
    const [runtime] = await this.presence.stampAsync([[processId, Resources.copyRuntimeRole]]);
    if (!Object.isUndefined(runtime))
      await new AppImageCopyRecord(runtime, extraction).writeAsync(record);
    return processId;
  }

  private async runExtractedAsync(source: AppImageSource, holder: UpdateProcess, extraction: string, executablePath: string, launchArguments: readonly string[],
    environment: NodeJS.ProcessEnv, startLog: string, record: string): Promise<number> {
    await new AppImageCopyRecord(holder, extraction).writeAsync(record);
    const folder = await this.extractAsync(source.file, extraction, environment, startLog);
    const move = AppImageCopyLaunch.mover(source, folder);
    return this.starter.startAsync(move(executablePath), launchArguments.map(move), { ...environment, [Resources.appImageFolderVariable]: folder }, startLog);
  }

  private async stampAsync(processId: number, role: string): Promise<UpdateProcess> {
    const [stamped] = await this.presence.stampAsync([[processId, role]]);
    if (Object.isUndefined(stamped))
      throw new AppImageCopyUnlistedException(processId);
    return stamped;
  }

  private async mountAsync(image: string, environment: NodeJS.ProcessEnv, startLog: string, record: string): Promise<readonly [number, string, number] | null> {
    const listing = `${record}${Resources.copyListingSuffix}`;
    let mounted: readonly [number, string, number] | null = null;
    let failure: string | null = null;
    try {
      mounted = await this.startMountAsync(image, environment, startLog, listing, record);
    }
    catch (error) {
      failure = String(error);
    }
    await rm(listing, { force: true });
    if (Object.isNull(mounted)) {
      await rm(record, { force: true });
      await appendFile(startLog, Object.isNull(failure) ? Resources.formatCopyNotMounted(image) : Resources.formatCopyMountFailed(image, failure));
    }
    return mounted;
  }

  private async startMountAsync(image: string, environment: NodeJS.ProcessEnv, startLog: string, listing: string, record: string):
    Promise<readonly [number, string, number] | null> {
    const holder = await this.stampAsync(process.pid, Resources.copyLauncherRole);
    await new AppImageCopyRecord(holder, null).writeAsync(record);
    const processId = await this.startMounterAsync(image, environment, startLog, listing);
    const mounted = await this.recordMountAsync(holder, processId, record).then(() => this.holdMountAsync(listing, processId)).catch((error: unknown) => {
      if (!AppImageCopyLaunch.signal(processId, Resources.copyEndSignal))
        return null;
      throw error;
    });
    if (Object.isNull(mounted))
      AppImageCopyLaunch.signal(processId, Resources.copyEndSignal);
    return mounted;
  }

  private async recordMountAsync(holder: UpdateProcess, mounter: number, record: string): Promise<void> {
    await new AppImageCopyRecord(holder, null, await this.stampAsync(mounter, Resources.copyMounterRole)).writeAsync(record);
  }

  private async startMounterAsync(image: string, environment: NodeJS.ProcessEnv, startLog: string, listing: string): Promise<number> {
    const errors = await open(startLog, Resources.appendFlag, Resources.privateFileMode);
    try {
      const output = await open(listing, Resources.appendFlag, Resources.privateFileMode);
      try {
        return this.posix.startDetached(image, [Resources.appImageMountOption], AppImageCopyLaunch.listEntries(environment), errors.fd, undefined, output.fd);
      }
      finally {
        await output.close();
      }
    }
    finally {
      await errors.close();
    }
  }

  private async holdMountAsync(listing: string, processId: number): Promise<readonly [number, string, number] | null> {
    const folder = await this.findMountAsync(listing, processId);
    const keepalive = Object.isNull(folder) ? null : this.openKeepalive(processId);
    return Object.isNull(folder) || Object.isNull(keepalive) ? null : [processId, folder, keepalive];
  }

  private async findMountAsync(listing: string, processId: number): Promise<string | null> {
    const watch = FolderWatch.open(path.dirname(listing), this.log);
    try {
      const deadline = performance.now() + this.mountWait;
      for (;;) {
        const text = await readFile(listing, Resources.utf8Encoding);
        const end = text.indexOf(Resources.lineSeparator);
        if (end > 0)
          return text.slice(0, end);
        if (end === 0 || AppImageCopyLaunch.hasEnded(processId) || performance.now() >= deadline)
          return null;
        await watch.waitAsync(deadline - performance.now(), AppImageCopyLaunch.hasEnded.bind(AppImageCopyLaunch, processId));
      }
    }
    finally {
      watch[Symbol.dispose]();
    }
  }
}
