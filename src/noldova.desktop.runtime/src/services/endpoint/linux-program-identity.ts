/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BigIntStats } from "node:fs";
import { open, readdir, readlink, stat } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { RuntimeException } from "../../exceptions/runtime.exception.js";
import type {} from "../../interfaces/process.js";
import type { PeerProcess } from "../../models/peer-process.js";
import { StampedFile } from "../../models/stamped-file.js";
import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";
import { LinuxProcessStart } from "../process/linux-process-start.js";
import { FileDigest } from "./file-digest.js";
import { LinuxMounts } from "./linux-mounts.js";

export class LinuxProgramIdentity {
  private readonly program: string;
  private readonly processFolder: string;
  private readonly readLink: (file: string) => Promise<string>;
  private readonly ownDigests: Map<StampedFile, Promise<string>> = new Map();
  private readonly peerDigests: Map<string, Promise<string>> = new Map();
  private own: Promise<readonly [StampedFile, StampedFile | null]> | null = null;

  public constructor(program: string, processFolder: string = Resources.processFolder, readLink: (file: string) => Promise<string> = readlink) {
    this.program = program;
    this.processFolder = processFolder;
    this.readLink = readLink;
  }

  private static withoutArchives<T>(call: () => T): T {
    const isArchiveOff = process.noAsar;
    process.noAsar = true;
    try {
      return call();
    }
    finally {
      process.noAsar = isArchiveOff;
    }
  }

  private static async stampAsync(file: string): Promise<StampedFile | null> {
    try {
      const stats = await LinuxProgramIdentity.withoutArchives(() => stat(file, { bigint: true }));
      return new StampedFile(file, stats.dev, stats.ino, stats.size);
    }
    catch (error) {
      if (SystemErrorCode.isAny(error, Resources.missingPathCodes))
        return null;
      throw error;
    }
  }

  private static async computeDigestAsync(file: StampedFile): Promise<string> {
    const handle = await LinuxProgramIdentity.withoutArchives(() => open(file.path, Resources.readFlag));
    try {
      const stats = await handle.stat({ bigint: true });
      if (!file.isSameFile(stats.dev, stats.ino))
        throw new RuntimeException(Resources.formatOwnFileChanged(file.path));
      return await FileDigest.computeAsync(handle, Number(stats.size));
    }
    finally {
      await handle.close();
    }
  }

  private static remember<T>(digests: Map<T, Promise<string>>, key: T, digest: Promise<string>): Promise<string> {
    digests.set(key, digest);
    digest.catch(() => digests.delete(key));
    return digest;
  }

  public prepare(): void {
    this.digestOwnAsync().catch(() => undefined);
  }

  public async isSameAsync(peer: PeerProcess): Promise<boolean> {
    if (Object.isNull(peer.processId) || Object.isNull(peer.startTime))
      return false;
    const folder = path.join(this.processFolder, String(peer.processId));
    const executable = path.join(folder, Resources.executableLink);
    const [[program, archive], target] = await Promise.all([this.readOwnAsync(), this.readLink(executable)]);
    if (target.endsWith(Resources.deletedLinkSuffix))
      return false;
    const archives = await this.findArchivesAsync(folder, path.join(path.dirname(target), Resources.appResourcesFolder, Resources.appArchiveName));
    const isSame = await this.isSameProgramAsync(executable, program) && await this.isSameArchiveAsync(archives, archive);
    return isSame && LinuxProcessStart.read(this.processFolder, peer.processId) === peer.startTime;
  }

  private async findArchivesAsync(folder: string, archive: string): Promise<readonly string[] | null> {
    const descriptors = path.join(folder, Resources.descriptorFolder);
    const names = await readdir(descriptors);
    const links = await Promise.all(names.map(t => this.readDescriptorAsync(path.join(descriptors, t))));
    if (links.includes(`${archive}${Resources.deletedLinkSuffix}`))
      return null;
    return names.filter((_, index) => links[index] === archive).map(t => path.join(descriptors, t));
  }

  private async readDescriptorAsync(file: string): Promise<string | null> {
    try {
      return await this.readLink(file);
    }
    catch (error) {
      if (SystemErrorCode.isAny(error, Resources.processSkippedCodes))
        return null;
      throw error;
    }
  }

  private async isSameProgramAsync(file: string, own: StampedFile): Promise<boolean> {
    const handle = await open(file, Resources.readFlag);
    try {
      return await this.isSameFileAsync(handle, await handle.stat({ bigint: true }), own, false);
    }
    finally {
      await handle.close();
    }
  }

  private async isSameArchiveAsync(files: readonly string[] | null, own: StampedFile | null): Promise<boolean> {
    if (Object.isNull(files))
      return false;
    if (files.length === 0)
      return Object.isNull(own);
    if (Object.isNull(own))
      return false;
    const handles = await Promise.all(files.map(t => open(t, Resources.readFlag)));
    try {
      const stats = await Promise.all(handles.map(t => t.stat({ bigint: true })));
      const [first] = stats;
      const [handle] = handles;
      if (Object.isUndefined(first) || Object.isUndefined(handle) || stats.some(t => t.dev !== first.dev || t.ino !== first.ino))
        return false;
      return await this.isSameFileAsync(handle, first, own, true);
    }
    finally {
      await Promise.all(handles.map(t => t.close()));
    }
  }

  private async isSameFileAsync(handle: FileHandle, stats: BigIntStats, own: StampedFile, isArchive: boolean): Promise<boolean> {
    if (own.isSameFile(stats.dev, stats.ino))
      return true;
    if (stats.size !== own.size)
      return false;
    const mounts = await LinuxMounts.readAsync(this.processFolder);
    const isReadOnly = mounts.isReadOnly(stats.dev);
    if (isArchive && !isReadOnly && !mounts.isWritable(own.device))
      return false;
    const [digest, ownDigest] = await Promise.all([this.digestPeerAsync(handle, stats, isReadOnly), this.digestOwnFileAsync(own)]);
    return digest === ownDigest;
  }

  private digestPeerAsync(handle: FileHandle, stats: BigIntStats, isReadOnly: boolean): Promise<string> {
    const digest = (): Promise<string> => FileDigest.computeAsync(handle, Number(stats.size));
    if (!isReadOnly)
      return digest();
    const key = [stats.dev, stats.ino, stats.size, stats.mtimeNs].join(Resources.senderSeparator);
    return this.peerDigests.get(key) ?? LinuxProgramIdentity.remember(this.peerDigests, key, digest());
  }

  private async digestOwnAsync(): Promise<void> {
    const [program, archive] = await this.readOwnAsync();
    await Promise.all((Object.isNull(archive) ? [program] : [program, archive]).map(t => this.digestOwnFileAsync(t)));
  }

  private readOwnAsync(): Promise<readonly [StampedFile, StampedFile | null]> {
    if (!Object.isNull(this.own))
      return this.own;
    const own = this.stampOwnAsync();
    this.own = own;
    own.catch(() => {
      this.own = null;
    });
    return own;
  }

  private async stampOwnAsync(): Promise<readonly [StampedFile, StampedFile | null]> {
    const archive = path.join(path.dirname(this.program), Resources.appResourcesFolder, Resources.appArchiveName);
    const [program, own] = await Promise.all([stat(this.program, { bigint: true }), LinuxProgramIdentity.stampAsync(archive)]);
    return [new StampedFile(this.program, program.dev, program.ino, program.size), own];
  }

  private digestOwnFileAsync(file: StampedFile): Promise<string> {
    return this.ownDigests.get(file) ?? LinuxProgramIdentity.remember(this.ownDigests, file, LinuxProgramIdentity.computeDigestAsync(file));
  }
}
