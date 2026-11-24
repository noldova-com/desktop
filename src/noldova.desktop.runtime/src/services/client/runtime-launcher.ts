/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { readFile, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { type BuildIdentity, FailureCode, type RuntimeHandover, RunningWork, StopPolicy } from "@noldova/desktop.protocol";

import { BuildRelation } from "../../enums/build-relation.js";
import { UpdateBarrierStatus } from "../../enums/update-barrier-status.js";
import { BuildMismatchException } from "../../exceptions/build-mismatch.exception.js";
import { ConnectionException } from "../../exceptions/connection.exception.js";
import { LaunchLimitReachedException } from "../../exceptions/launch-limit-reached.exception.js";
import { LaunchTimedOutException } from "../../exceptions/launch-timed-out.exception.js";
import { LaunchException } from "../../exceptions/launch.exception.js";
import { MainProcessRefusedAgainException } from "../../exceptions/main-process-refused-again.exception.js";
import { MoveAsideRefusedException } from "../../exceptions/move-aside-refused.exception.js";
import { NoRuntimeException } from "../../exceptions/no-runtime.exception.js";
import { PreShellDataFoundException } from "../../exceptions/pre-shell-data-found.exception.js";
import { RuntimeExitedWithoutReasonException } from "../../exceptions/runtime-exited-without-reason.exception.js";
import { RuntimeExitedException } from "../../exceptions/runtime-exited.exception.js";
import { RuntimeHandoverException } from "../../exceptions/runtime-handover.exception.js";
import { StopRefusedException } from "../../exceptions/stop-refused.exception.js";
import { StopTimedOutException } from "../../exceptions/stop-timed-out.exception.js";
import { UpdateInProgressException } from "../../exceptions/update-in-progress.exception.js";
import { WorkInProgressException } from "../../exceptions/work-in-progress.exception.js";
import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import type { IRuntimeClientListener } from "../../interfaces/i-runtime-client-listener.js";
import { AppImageSource } from "../../models/app-image-source.js";
import { AttachOptions } from "../../models/attach-options.js";
import { Endpoint } from "../../models/endpoint.js";
import type { LaunchSettings } from "../../models/launch-settings.js";
import { ProductInfo } from "../../models/product-info.js";
import type { RuntimeDiscovery } from "../../models/runtime-discovery.js";
import { StartedRuntime } from "../../models/started-runtime.js";
import { SystemErrorCode } from "../../models/system-error-code.js";
import { FolderCreation } from "../files/folder-creation.js";
import { Resources } from "../../resources.js";
import { DiagnosticRedactor } from "../diagnostics/diagnostic-redactor.js";
import { StandardErrorCap } from "../diagnostics/standard-error-cap.js";
import { DiscoveryReader } from "../discovery/discovery.reader.js";
import { FolderWatch } from "../files/folder-watch.js";
import type { Installation } from "../installation/installation.js";
import { ProcessPresence } from "../installation/process-presence.js";
import { OwnershipLock } from "../ownership/ownership-lock.js";
import { ChildProcessStarter } from "../process/child-process-starter.js";
import { PosixProcessApi } from "../process/posix-process-api.js";
import { AppImageCopyLaunch } from "./app-image-copy-launch.js";
import { AppImageExtraction } from "./app-image-extraction.js";
import { AppImageKeepalive } from "./app-image-keepalive.js";
import { BuildComparer } from "./build-comparer.js";
import { RuntimeClient } from "./runtime-client.js";

export class RuntimeLauncher {
  private readonly settings: LaunchSettings;
  private readonly identity: BuildIdentity;
  private readonly starter: IProcessStarter;
  private readonly installation: Installation;
  private readonly presence: ProcessPresence;
  private readonly log: (text: string) => void;

  public constructor(settings: LaunchSettings, identity: BuildIdentity, installation: Installation, log: (text: string) => void,
    starter: IProcessStarter = new ChildProcessStarter(), presence: ProcessPresence = ProcessPresence.create(process.platform)) {
    this.settings = settings;
    this.identity = identity;
    this.starter = starter;
    this.installation = installation;
    this.log = log;
    this.presence = presence;
  }

  public async attachAsync(clientName: string, listener: IRuntimeClientListener, policy: StopPolicy = StopPolicy.IfIdle, options: AttachOptions = new AttachOptions()): Promise<RuntimeClient> {
    return RuntimeLauncher.requireCurrentData(await this.connectAsync(clientName, listener, policy, options));
  }

  public async moveAsideAsync(clientName: string, listener: IRuntimeClientListener, policy: StopPolicy = StopPolicy.IfIdle): Promise<RuntimeClient> {
    const client = await this.connectAsync(clientName, listener, policy, new AttachOptions());
    if (Object.isNull(client.preShellData))
      return client;

    const response = await client.moveAsideAsync().finally(() => client.close());
    const failure = response.failure;
    if (!Object.isUndefined(failure))
      throw new MoveAsideRefusedException(failure);
    return this.attachAsync(clientName, listener, policy);
  }

  private static requireCurrentData(client: RuntimeClient): RuntimeClient {
    const data = client.preShellData;
    if (Object.isNull(data))
      return client;
    client.close();
    throw new PreShellDataFoundException(data);
  }

  private async connectAsync(clientName: string, listener: IRuntimeClientListener, policy: StopPolicy, options: AttachOptions): Promise<RuntimeClient> {
    const watch = FolderWatch.open(this.settings.dataDirectory.discoveryFolder, this.log);
    try {
      let deadline = Date.now() + this.settings.launchTimeout;
      let limit = Date.now() + this.settings.launchLimit;
      let started: StartedRuntime | null = null;
      let refusals = 0;
      let isRefusedBefore = false;
      for (;;) {
        const discovery = await DiscoveryReader.readAsync(this.settings.dataDirectory);
        if (!Object.isNull(discovery) && OwnershipLock.isOwned(this.settings.dataDirectory)) {
          const client = await this.tryConnectAsync(discovery, clientName, listener).catch(async (error: unknown) => {
            if (refusals >= Resources.refusedTokenRetries || !await this.isRepublishedAsync(error, discovery))
              throw error;
            refusals++;
            return null;
          });
          if (!Object.isNull(client)) {
            await this.keepAsync(started, discovery).catch((error: unknown) => {
              client.close();
              throw error;
            });
            started = null;
            const handover = client.handover;
            if (Object.isNull(handover))
              return client;
            if (client.isRefusedAsMainProcess && isRefusedBefore) {
              client.close();
              throw new MainProcessRefusedAgainException();
            }
            isRefusedBefore ||= client.isRefusedAsMainProcess;
            await this.resolveOtherBuildAsync(client, handover, policy, options.takeOver, watch);
            deadline = Date.now() + this.settings.launchTimeout;
            limit = Date.now() + this.settings.launchLimit;
            continue;
          }
        }
        else if (Object.isNull(started)) {
          if (!options.start)
            throw new NoRuntimeException(this.settings.dataDirectory.root);
          await this.requireNoUpdateAsync();
          started = await this.startAsync();
        }
        else if (!started.isRunning && !OwnershipLock.isOwned(this.settings.dataDirectory))
          throw await this.describeExitAsync(started);
        const timeout = this.readTimeout(deadline, limit);
        if (!Object.isNull(timeout)) {
          await RuntimeLauncher.forgetAsync(started);
          throw timeout;
        }
        await watch.waitAsync((Date.now() < deadline ? deadline : limit) - Date.now(), () => this.isLost(started));
      }
    }
    finally {
      watch[Symbol.dispose]();
    }
  }

  private isLost(started: StartedRuntime | null): boolean {
    return (Object.isNull(started) || !started.isRunning) && !OwnershipLock.isOwned(this.settings.dataDirectory);
  }

  private readTimeout(deadline: number, limit: number): LaunchException | null {
    if (Date.now() < deadline)
      return null;
    const isOwned = OwnershipLock.isOwned(this.settings.dataDirectory);
    if (isOwned && Date.now() < limit)
      return null;
    return isOwned ? new LaunchLimitReachedException(this.settings.launchLimit) : new LaunchTimedOutException();
  }

  private static async forgetAsync(started: StartedRuntime | null): Promise<void> {
    if (!Object.isNull(started))
      await rm(started.startLog, { force: true });
  }

  private async keepAsync(started: StartedRuntime | null, discovery: RuntimeDiscovery): Promise<void> {
    if (Object.isNull(started) || started.processId !== discovery.processId) {
      await RuntimeLauncher.forgetAsync(started);
      return;
    }
    const directory = this.settings.dataDirectory;
    try {
      await StandardErrorCap.keepAsync(directory.runtimeErrorsLog, directory.previousRuntimeErrorsLog, new DiagnosticRedactor(homedir(), [ProductInfo.current.name]));
    }
    catch (error) {
      if (!SystemErrorCode.isAny(error, Resources.errorsCapSkippedCodes))
        throw error;
      if (!SystemErrorCode.is(error, Resources.missingFileErrorCode))
        return;
    }
    try {
      await rename(started.startLog, directory.runtimeErrorsLog);
    }
    catch (error) {
      if (!SystemErrorCode.isAny(error, Resources.startLogKeptCodes))
        throw error;
    }
  }

  private async describeExitAsync(started: StartedRuntime): Promise<LaunchException> {
    const text = await readFile(started.startLog, Resources.utf8Encoding);
    await rm(started.startLog, { force: true });
    await this.requireNoUpdateAsync().catch((error: unknown) => {
      if (error instanceof UpdateInProgressException)
        throw error;
    });
    const reason = new DiagnosticRedactor(homedir(), [ProductInfo.current.name]).redact(text.slice(-Resources.startLogTailLength).trim());
    return String.isNullOrWhitespace(reason) ? new RuntimeExitedWithoutReasonException() : new RuntimeExitedException(reason);
  }

  private async tryConnectAsync(discovery: RuntimeDiscovery, clientName: string, listener: IRuntimeClientListener): Promise<RuntimeClient | null> {
    try {
      return await RuntimeClient.connectAsync(Endpoint.parse(discovery.endpoint), discovery.token, this.identity, clientName, listener, this.settings.clientSettings);
    }
    catch (error) {
      if (error instanceof ConnectionException && Object.isNull(error.failure))
        return null;
      throw error;
    }
  }

  private async isRepublishedAsync(error: unknown, discovery: RuntimeDiscovery): Promise<boolean> {
    return error instanceof ConnectionException && error.failure?.code === FailureCode.Unauthorized &&
      (await DiscoveryReader.readAsync(this.settings.dataDirectory))?.token !== discovery.token;
  }

  private async resolveOtherBuildAsync(client: RuntimeClient, handover: RuntimeHandover, policy: StopPolicy, takeOver: boolean, watch: FolderWatch): Promise<void> {
    if (BuildComparer.compare(this.identity, handover.identity) === BuildRelation.Older) {
      client.close();
      throw new RuntimeHandoverException(handover);
    }
    if (!takeOver) {
      client.close();
      throw new BuildMismatchException(handover);
    }

    const response = await client.stopAsync(policy).finally(() => client.close());
    const failure = response.failure;
    if (!Object.isUndefined(failure)) {
      if (failure.code === FailureCode.Conflict && !Object.isUndefined(failure.details))
        throw new WorkInProgressException(RunningWork.fromJson(failure.details));
      throw new StopRefusedException(failure);
    }
    const deadline = Date.now() + this.settings.stopTimeout;
    while (OwnershipLock.isOwned(this.settings.dataDirectory)) {
      if (Date.now() >= deadline)
        throw new StopTimedOutException();
      await watch.waitAsync(deadline - Date.now(), () => !OwnershipLock.isOwned(this.settings.dataDirectory));
    }
  }

  private async requireNoUpdateAsync(): Promise<void> {
    const status = await this.installation.checkAsync(this.identity.productVersion);
    if (status !== UpdateBarrierStatus.None)
      throw new UpdateInProgressException(status);
  }

  private async startAsync(): Promise<StartedRuntime> {
    const directory = this.settings.dataDirectory;
    const unique = randomUUID();
    const startLogName = Resources.formatStartLogName(unique);
    const launchArguments = [
      this.settings.entryPath,
      Resources.dataDirectoryArgument,
      directory.root,
      Resources.idleGraceArgument,
      String(this.settings.idleGraceMilliseconds),
      Resources.startLogArgument,
      startLogName,
      Resources.installationArgument,
      this.installation.folder
    ];
    const source = this.settings.platform === Resources.linuxPlatform ? AppImageSource.find(this.settings.environment, this.settings.executablePath) : null;
    await FolderCreation.createAsync(directory.logsFolder);
    const startLog = path.join(directory.logsFolder, startLogName);
    const processId = await (Object.isNull(source)
      ? this.starter.startAsync(this.settings.executablePath, launchArguments, this.settings.environment, startLog)
      : new AppImageCopyLaunch(this.starter, PosixProcessApi.create(), this.presence, AppImageKeepalive.open, AppImageExtraction.extractAsync, this.log)
        .startAsync(source, this.settings.executablePath, launchArguments, this.settings.environment, startLog, path.join(directory.logsFolder, Resources.formatCopyRecordName(unique))));
    return new StartedRuntime(processId, startLog);
  }
}
