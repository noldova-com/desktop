/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import type { Socket } from "node:net";
import path from "node:path";

import "@noldova/context.core";

import { AddonIncompleteException } from "../../exceptions/addon-incomplete.exception.js";
import { RuntimeException } from "../../exceptions/runtime.exception.js";
import type { IPeerProcessApi } from "../../interfaces/i-peer-process-api.js";
import type { IPosixProcessAddon } from "../../interfaces/i-posix-process-addon.js";
import { PeerProcess } from "../../models/peer-process.js";
import { Resources } from "../../resources.js";
import { NativeAddon } from "../native/native-addon.js";
import { LinuxProcessStart } from "./linux-process-start.js";

export class PosixPeerProcessApi implements IPeerProcessApi {
  private readonly addon: NativeAddon<IPosixProcessAddon>;
  private readonly platform: string;
  private readonly processFolder: string;

  public constructor(addon: NativeAddon<IPosixProcessAddon>, platform: string = process.platform, processFolder: string = Resources.processFolder) {
    this.addon = addon;
    this.platform = platform;
    this.processFolder = processFolder;
  }

  public static create(platform: string = process.platform): PosixPeerProcessApi {
    const functions = platform === Resources.linuxPlatform
      ? [Resources.peerProcessIdFunction]
      : [Resources.peerTokenFunction, Resources.readProcessPathFunction, Resources.readEnvironmentFunction];
    return new PosixPeerProcessApi(new NativeAddon<IPosixProcessAddon>(NativeAddon.locate(Resources.posixAddonFile), functions), platform);
  }

  private static isStrings(value: unknown): value is readonly string[] | null {
    return Object.isNull(value) || (Array.isArray(value) && value.every(t => Object.isString(t)));
  }

  private static isToken(value: unknown): value is readonly [number, number] | null {
    return Object.isNull(value) || (Array.isArray(value) && value.length === 2 && value.every(t => Object.isNumber(t) && Number.isInteger(t) && t >= 0));
  }

  private static findDescriptor(socket: Socket): number | null {
    const handle: unknown = Resources.socketHandleField in socket && socket[Resources.socketHandleField];
    if (Object.isNull(handle))
      return null;
    const descriptor: unknown = Object.isObject(handle) && Resources.socketDescriptorField in handle ? handle[Resources.socketDescriptorField] : undefined;
    if (!Object.isNumber(descriptor))
      throw new RuntimeException(Resources.formatSocketMemberMissing(Resources.socketHandleField, Resources.socketDescriptorField));
    return descriptor >= 0 ? descriptor : null;
  }

  public async readAsync(socket: Socket): Promise<PeerProcess | null> {
    if (this.platform !== Resources.linuxPlatform)
      return this.readFromAddon(socket);
    const processId = this.findProcessId(socket);
    if (Object.isNull(processId))
      return null;
    const folder = path.posix.join(this.processFolder, String(processId));
    const startTime = await LinuxProcessStart.readAsync(this.processFolder, processId);
    const environment = await readFile(path.posix.join(folder, Resources.environmentFile), Resources.utf8Encoding);
    return new PeerProcess(path.posix.join(folder, Resources.executableLink), environment.split(Resources.environmentSeparator).filter(t => t.length > 0), null, processId, startTime);
  }

  public readSender(socket: Socket): string | null {
    if (this.platform === Resources.linuxPlatform)
      return null;
    const token = this.readToken(socket);
    return Object.isNull(token) ? null : token.join(Resources.senderSeparator);
  }

  private findProcessId(socket: Socket): number | null {
    const descriptor = PosixPeerProcessApi.findDescriptor(socket);
    if (Object.isNull(descriptor))
      return null;
    const addon = this.addon.load();
    if (Object.isUndefined(addon.peerProcessId))
      throw new AddonIncompleteException(this.addon.name);
    const processId = this.addon.expect(addon.peerProcessId(descriptor), (t): t is number => Object.isNumber(t) && Number.isInteger(t));
    return processId > 0 ? processId : null;
  }

  private readToken(socket: Socket): readonly [number, number] | null {
    const descriptor = PosixPeerProcessApi.findDescriptor(socket);
    if (Object.isNull(descriptor))
      return null;
    const addon = this.addon.load();
    if (Object.isUndefined(addon.peerToken))
      throw new AddonIncompleteException(this.addon.name);
    const token = this.addon.expect(addon.peerToken(descriptor), PosixPeerProcessApi.isToken);
    return Object.isNull(token) || token[0] <= 0 ? null : token;
  }

  private readFromAddon(socket: Socket): PeerProcess | null {
    const token = this.readToken(socket);
    if (Object.isNull(token))
      return null;
    const sender = token.join(Resources.senderSeparator);
    const addon = this.addon.load();
    if (Object.isUndefined(addon.readProcessPath) || Object.isUndefined(addon.readEnvironment))
      throw new AddonIncompleteException(this.addon.name);
    const program = this.addon.expect(addon.readProcessPath(token[0]), (t): t is string | null => Object.isString(t) || Object.isNull(t));
    const environment = this.addon.expect(addon.readEnvironment(token[0]), PosixPeerProcessApi.isStrings);
    return Object.isNull(program) || Object.isNull(environment) || this.readSender(socket) !== sender ? null : new PeerProcess(program, environment, sender);
  }
}
