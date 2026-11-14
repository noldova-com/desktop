/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Socket } from "node:net";

import "@noldova/context.core";

import type { IPeerProcessApi } from "../../interfaces/i-peer-process-api.js";
import type { IWindowsPeerAddon } from "../../interfaces/i-windows-peer-addon.js";
import { PeerProcess } from "../../models/peer-process.js";
import { Resources } from "../../resources.js";
import { NativeAddon } from "../native/native-addon.js";

export class WindowsPeerProcessApi implements IPeerProcessApi {
  private readonly addon: NativeAddon<IWindowsPeerAddon>;

  public constructor(file: string) {
    this.addon = new NativeAddon<IWindowsPeerAddon>(file, Resources.windowsPeerFunctions);
  }

  public static create(): WindowsPeerProcessApi {
    return new WindowsPeerProcessApi(NativeAddon.locate(Resources.windowsAddonFile));
  }

  private static isOwner(value: unknown): value is readonly [number, bigint] | null {
    return Object.isNull(value) || (Array.isArray(value) && value.length === 2 && Object.isNumber(value[0]) && Number.isInteger(value[0]) && value[0] > 0 && Object.isBigInt(value[1]));
  }

  public readAsync(socket: Socket): Promise<PeerProcess | null> {
    return Promise.try(() => this.read(socket));
  }

  public readSender(): string | null {
    return null;
  }

  private read(socket: Socket): PeerProcess | null {
    if (Object.isUndefined(socket.remotePort) || Object.isUndefined(socket.localPort))
      return null;
    const owner = this.addon.expect(this.addon.load().findTcpOwner(socket.remotePort, socket.localPort), WindowsPeerProcessApi.isOwner);
    if (Object.isNull(owner))
      return null;
    const [processId, connected] = owner;
    const handle = this.addon.expect(this.addon.load().openProcess(processId, Resources.windowsReadAccess),
      (t): t is bigint | number => Object.isBigInt(t) || Object.isNumber(t));
    if (!Object.isBigInt(handle))
      return null;
    try {
      const started = this.addon.expect(this.addon.load().readCreationTime(handle), (t): t is bigint | null => Object.isBigInt(t) || Object.isNull(t));
      if (Object.isNull(started) || started > connected)
        return null;
      const program = this.addon.expect(this.addon.load().readImagePath(handle), (t): t is string | null => Object.isString(t) || Object.isNull(t));
      const environment = this.addon.expect(this.addon.load().readEnvironment(handle),
        (t): t is readonly string[] | null => Object.isNull(t) || (Array.isArray(t) && t.every(u => Object.isString(u))));
      return Object.isNull(program) || Object.isNull(environment) ? null : new PeerProcess(program, environment);
    }
    finally {
      this.addon.load().closeHandle(handle);
    }
  }
}
