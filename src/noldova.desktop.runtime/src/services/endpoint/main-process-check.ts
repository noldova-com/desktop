/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { stat } from "node:fs/promises";
import type { Socket } from "node:net";

import "@noldova/context.core";

import { RuntimeException } from "../../exceptions/runtime.exception.js";
import type { IMainProcessCheck } from "../../interfaces/i-main-process-check.js";
import type { IPeerProcessApi } from "../../interfaces/i-peer-process-api.js";
import { Resources } from "../../resources.js";
import { PosixPeerProcessApi } from "../process/posix-peer-process-api.js";
import { WindowsPeerProcessApi } from "../process/windows-peer-process-api.js";
import { LinuxProgramIdentity } from "./linux-program-identity.js";

export class MainProcessCheck implements IMainProcessCheck {
  private static readonly RUN_AS_NODE: string = `${Resources.runAsNodeVariable}${Resources.environmentEntrySeparator}`;

  private readonly peers: IPeerProcessApi;
  private readonly platform: string;
  private readonly program: string;
  private readonly identity: LinuxProgramIdentity;
  private readonly senders: WeakMap<Socket, string | null> = new WeakMap();
  private readonly starts: WeakMap<Socket, string | Error | null> = new WeakMap();

  public constructor(peers: IPeerProcessApi, platform: string = process.platform, program: string = process.execPath, identity: LinuxProgramIdentity = new LinuxProgramIdentity(program)) {
    this.peers = peers;
    this.platform = platform;
    this.program = program;
    this.identity = identity;
  }

  public static create(platform: string = process.platform, program: string = process.execPath, environment: NodeJS.ProcessEnv = process.env): MainProcessCheck {
    const peers = platform === Resources.windowsPlatform ? WindowsPeerProcessApi.create() : PosixPeerProcessApi.create(platform);
    const identity = new LinuxProgramIdentity(program);
    if (platform === Resources.linuxPlatform && !Object.isUndefined(environment[Resources.appImageVariable]))
      identity.prepare();
    return new MainProcessCheck(peers, platform, program, identity);
  }

  private static isRunAsNode(entry: string): boolean {
    return entry.toUpperCase().startsWith(MainProcessCheck.RUN_AS_NODE);
  }

  public accept(socket: Socket): void {
    if (this.platform !== Resources.linuxPlatform)
      return;
    try {
      this.starts.set(socket, this.peers.readStart(socket));
    }
    catch (error) {
      this.starts.set(socket, error instanceof Error ? error : new RuntimeException(String(error)));
    }
  }

  public async isMainProcessAsync(socket: Socket): Promise<boolean> {
    const start = this.starts.get(socket);
    if (start instanceof Error)
      throw start;
    const peer = await this.peers.readAsync(socket);
    if (Object.isNull(peer) || peer.environment.some(t => MainProcessCheck.isRunAsNode(t)))
      return false;
    if (this.platform === Resources.linuxPlatform
      ? Object.isNullOrUndefined(start) || start !== peer.startTime || !await this.identity.isSameAsync(peer)
      : !await this.isSameFileAsync(peer.program))
      return false;
    this.senders.set(socket, peer.sender);
    return true;
  }

  public isSameSender(socket: Socket): boolean {
    const sender = this.senders.get(socket);
    return !Object.isUndefined(sender) && this.peers.readSender(socket) === sender;
  }

  private async isSameFileAsync(file: string): Promise<boolean> {
    const [own, peer] = await Promise.all([stat(this.program, { bigint: true }), stat(file, { bigint: true })]);
    return own.dev === peer.dev && own.ino === peer.ino;
  }
}
