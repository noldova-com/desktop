/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";
import { FailureCode, ShellEvents, ShellMethods, StopPolicy, UpdateSaved } from "@noldova/desktop.protocol";
import {
  AppImageSource,
  type AttachOptions,
  ConnectionException,
  type DataDirectory,
  DataDirectoryLocator,
  DeviceFolder,
  type IRuntimeClientListener,
  Installation,
  LaunchSettings,
  ProcessPresence,
  type RuntimeClient,
  RuntimeLauncher,
  UpdateBarrierStatus,
  UpdateInProgressException
} from "@noldova/desktop.runtime";

import type { CliContext } from "../models/cli-context.js";
import { Resources } from "../resources.js";
import { InstallationWatch } from "./installation-watch.js";

export class RuntimeAttacher {
  private static readonly QUIET: IRuntimeClientListener = { onEvent: () => undefined, onDisconnected: () => undefined };

  private readonly context: CliContext;
  private isUpdatingValue: boolean = false;

  public constructor(context: CliContext) {
    this.context = context;
  }

  public get isUpdating(): boolean {
    return this.isUpdatingValue;
  }

  public locate(dataDirectory: string | null): DataDirectory {
    const checkout = this.context.environment[Resources.checkoutVariable] ?? String.empty;
    const explicit = Object.isNull(dataDirectory) ? undefined : path.resolve(dataDirectory);
    return DataDirectoryLocator.locate(String.isNullOrWhitespace(checkout), this.context.environment, this.context.homeFolder, checkout, explicit);
  }

  public async attachAsync(
    clientName: string,
    deviceDirectory: string | null,
    directory: DataDirectory,
    options: AttachOptions,
    listener: IRuntimeClientListener = RuntimeAttacher.QUIET): Promise<RuntimeClient> {
    const installation = this.createInstallation(deviceDirectory);
    const launcher = this.createLauncher(installation, directory);
    const deadline = Date.now() + this.context.updateWaitMilliseconds;
    const watch = new InstallationWatch(installation.folder, t => this.context.error.write(`${t}${Resources.lineEnd}`));
    try {
      for (;;) {
        try {
          return await this.connectAsync(launcher, clientName, options, listener);
        }
        catch (error) {
          if (!RuntimeAttacher.isUpdateUnderWay(error) || Date.now() >= deadline)
            throw error;
        }
        await watch.waitAsync(deadline - Date.now());
      }
    }
    finally {
      watch[Symbol.dispose]();
    }
  }

  private createInstallation(deviceDirectory: string | null): Installation {
    const context = this.context;
    const deviceFolder = Object.isNull(deviceDirectory)
      ? DeviceFolder.locate(context.platform, context.environment, context.homeFolder)
      : path.resolve(deviceDirectory);
    const presence = ProcessPresence.create(context.platform);
    return new Installation(Installation.locate(deviceFolder, AppImageSource.locateProgram(context.environment, context.executablePath), context.platform), t => presence.isRunningAsync(t));
  }

  private createLauncher(installation: Installation, directory: DataDirectory): RuntimeLauncher {
    const context = this.context;
    const environment = { ...context.environment, [Resources.runAsNodeVariable]: Resources.runAsNodeValue };
    const settings = new LaunchSettings(directory, context.executablePath, context.runtimeEntryPath, environment, context.platform);
    return new RuntimeLauncher(settings, context.identity, installation, t => context.error.write(`${t}${Resources.lineEnd}`), context.runtimeStarter);
  }

  private async connectAsync(launcher: RuntimeLauncher, clientName: string, options: AttachOptions, listener: IRuntimeClientListener): Promise<RuntimeClient> {
    const attached = Promise.withResolvers<RuntimeClient>();
    const client = await launcher.attachAsync(clientName, {
      onEvent: event => {
        if (event.name.equals(ShellEvents.updating))
          void attached.promise.then(t => this.answerUpdate(t));
        listener.onEvent(event);
      },
      onDisconnected: failure => listener.onDisconnected(failure)
    }, StopPolicy.IfIdle, options);
    attached.resolve(client);
    return client;
  }

  private answerUpdate(client: RuntimeClient): void {
    this.isUpdatingValue = true;
    const close = (): void => client.close();
    void client.callAsync(ShellMethods.updateSaved, new UpdateSaved(this.context.processId, []).toJson()).then(close, close);
  }

  private static isUpdateUnderWay(error: unknown): boolean {
    return (error instanceof UpdateInProgressException && error.status === UpdateBarrierStatus.Held)
      || (error instanceof ConnectionException && error.failure?.code === FailureCode.Updating);
  }
}
