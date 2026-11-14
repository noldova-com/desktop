/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { ShellEvents, StopPolicy } from "@noldova/desktop.protocol";
import { AttachOptions, DataDirectory, DiscoveryReader, type IRuntimeClientListener, NoRuntimeException, OwnershipLock, type ProcessPresence,
  type RuntimeDiscovery } from "@noldova/desktop.runtime";

import { UpdateRuntimeNotFoundException } from "../exceptions/update-runtime-not-found.exception.js";
import { UpdateRuntimeNotReachedException } from "../exceptions/update-runtime-not-reached.exception.js";
import { UpdateRuntimeStillStartingException } from "../exceptions/update-runtime-still-starting.exception.js";
import { UpdateStopException } from "../exceptions/update-stop.exception.js";
import type { IRuntimeConnection } from "../interfaces/i-runtime-connection.js";
import type { IRuntimeLauncher } from "../interfaces/i-runtime-launcher.js";
import type { IUpdateTarget } from "../interfaces/i-update-target.js";
import { Resources } from "../resources.js";

export class UpdateTargetConnector {
  private readonly installationFolder: string;
  private readonly locate: (program: string) => string;
  private readonly createLauncher: (dataDirectory: DataDirectory) => IRuntimeLauncher;
  private readonly presence: Pick<ProcessPresence, "stampAsync">;
  private readonly now: () => number;
  private readonly wait: (milliseconds: number) => Promise<void>;

  public constructor(
    installationFolder: string,
    locate: (program: string) => string,
    createLauncher: (dataDirectory: DataDirectory) => IRuntimeLauncher,
    presence: Pick<ProcessPresence, "stampAsync">,
    now: () => number,
    wait: (milliseconds: number) => Promise<void>) {
    this.installationFolder = installationFolder;
    this.locate = locate;
    this.createLauncher = createLauncher;
    this.presence = presence;
    this.now = now;
    this.wait = wait;
  }

  public async connectAsync(root: string, onChange: () => void): Promise<IUpdateTarget | null> {
    const dataDirectory = new DataDirectory(root);
    let connection: IRuntimeConnection | null = null;
    try {
      const discovery = await this.findDiscoveryAsync(dataDirectory, root);
      if (Object.isNull(discovery) || this.locate(discovery.executablePath) !== this.installationFolder)
        return null;
      connection = await this.attachAsync(dataDirectory, UpdateTargetConnector.listen(onChange));
      if (Object.isNull(connection))
        return null;
      const current = await DiscoveryReader.readAsync(dataDirectory);
      const [runtime] = Object.isNull(current) ? [] : await this.presence.stampAsync([[current.processId, Resources.runtimeRole]]);
      if (Object.isUndefined(runtime))
        throw new UpdateRuntimeNotFoundException(root);
      return { dataDirectory: root, runtime, connection };
    }
    catch (error) {
      connection?.close();
      throw error instanceof UpdateStopException ? error : new UpdateRuntimeNotReachedException(root, new ExceptionOptions(error));
    }
  }

  private static listen(onChange: () => void): IRuntimeClientListener {
    return {
      onEvent: t => {
        if (t.name.equals(ShellEvents.work))
          onChange();
      },
      onDisconnected: () => onChange()
    };
  }

  private async findDiscoveryAsync(dataDirectory: DataDirectory, root: string): Promise<RuntimeDiscovery | null> {
    const deadline = this.now() + Resources.runtimeStartWait;
    for (;;) {
      const discovery = await DiscoveryReader.readAsync(dataDirectory);
      if (!Object.isNull(discovery) || !OwnershipLock.isOwned(dataDirectory))
        return discovery;
      if (this.now() >= deadline)
        throw new UpdateRuntimeStillStartingException(root);
      await this.wait(Resources.runtimeStartInterval);
    }
  }

  private async attachAsync(dataDirectory: DataDirectory, listener: IRuntimeClientListener): Promise<IRuntimeConnection | null> {
    try {
      return await this.createLauncher(dataDirectory).attachAsync(Resources.updateClientName, listener, StopPolicy.IfIdle, new AttachOptions(false, false));
    }
    catch (error) {
      if (error instanceof NoRuntimeException)
        return null;
      throw error;
    }
  }
}
