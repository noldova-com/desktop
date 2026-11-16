/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { open, readFile, stat } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { RuntimeException } from "../../exceptions/runtime.exception.js";
import { MappedFile } from "../../models/mapped-file.js";
import type { PeerProcess } from "../../models/peer-process.js";
import { StampedFile } from "../../models/stamped-file.js";
import { Resources } from "../../resources.js";
import { LinuxProcessStart } from "../process/linux-process-start.js";
import { FileDigest } from "./file-digest.js";

export class LinuxProgramIdentity {
  private readonly program: string;
  private readonly processFolder: string;
  private readonly digests: Map<StampedFile, Promise<string>> = new Map();
  private own: Promise<readonly [StampedFile, StampedFile | null]> | null = null;

  public constructor(program: string, processFolder: string = Resources.processFolder) {
    this.program = program;
    this.processFolder = processFolder;
  }

  private static readArchives(text: string): readonly MappedFile[] {
    const files = new Map<string, MappedFile>();
    for (const line of text.split(Resources.lineSeparator)) {
      const match = Resources.mappedFilePattern.exec(line);
      if (Object.isNull(match))
        continue;
      const name = String(match[4]);
      const isDeleted = name.endsWith(Resources.deletedMappingSuffix);
      const file = isDeleted ? name.slice(0, name.length - Resources.deletedMappingSuffix.length) : name;
      if (path.basename(file) !== Resources.appArchiveName)
        continue;
      const device = LinuxProgramIdentity.encodeDevice(LinuxProgramIdentity.readHex(String(match[1])), LinuxProgramIdentity.readHex(String(match[2])));
      const mapped = new MappedFile(file, device, BigInt(String(match[3])), isDeleted);
      files.set([mapped.device, mapped.inode, mapped.isDeleted].join(Resources.senderSeparator), mapped);
    }
    return [...files.values()];
  }

  private static readHex(text: string): bigint {
    return BigInt(`${Resources.hexNumberPrefix}${text}`);
  }

  private static encodeDevice(major: bigint, minor: bigint): bigint {
    return ((major & ~Resources.deviceMajorLowMask) << Resources.deviceMajorHighShift) | ((major & Resources.deviceMajorLowMask) << Resources.deviceMajorLowShift)
      | ((minor & ~Resources.deviceMinorLowMask) << Resources.deviceMinorHighShift) | (minor & Resources.deviceMinorLowMask);
  }

  private static async stampAsync(archive: MappedFile): Promise<StampedFile> {
    const stats = await stat(archive.path, { bigint: true });
    if (!archive.isSameFile(stats.dev, stats.ino))
      throw new RuntimeException(Resources.formatOwnFileChanged(archive.path));
    return new StampedFile(archive.path, archive.device, archive.inode, stats.size);
  }

  private static async computeDigestAsync(file: StampedFile): Promise<string> {
    const handle = await open(file.path, Resources.readFlag);
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

  public prepare(): void {
    this.digestOwnAsync().catch(() => undefined);
  }

  public async isSameAsync(peer: PeerProcess): Promise<boolean> {
    if (Object.isNull(peer.processId) || Object.isNull(peer.startTime))
      return false;
    const folder = path.posix.join(this.processFolder, String(peer.processId));
    const [program, archive] = await this.readOwnAsync();
    const isSame = await this.isSameFileAsync(path.posix.join(folder, Resources.executableLink), program, null)
      && await this.isSameArchiveAsync(path.posix.join(folder, Resources.mapsFile), archive);
    return isSame && await LinuxProcessStart.readAsync(this.processFolder, peer.processId) === peer.startTime;
  }

  private async isSameArchiveAsync(maps: string, own: StampedFile | null): Promise<boolean> {
    const archives = LinuxProgramIdentity.readArchives(await readFile(maps, Resources.utf8Encoding));
    const [archive] = archives;
    if (Object.isUndefined(archive))
      return Object.isNull(own);
    if (archives.length > 1 || archive.isDeleted || Object.isNull(own))
      return false;
    return own.isSameFile(archive.device, archive.inode) || await this.isSameFileAsync(archive.path, own, archive);
  }

  private async isSameFileAsync(file: string, own: StampedFile, mapped: MappedFile | null): Promise<boolean> {
    const handle = await open(file, Resources.readFlag);
    try {
      const stats = await handle.stat({ bigint: true });
      if (!Object.isNull(mapped) && !mapped.isSameFile(stats.dev, stats.ino))
        return false;
      if (own.isSameFile(stats.dev, stats.ino))
        return true;
      if (stats.size !== own.size)
        return false;
      const [digest, ownDigest] = await Promise.all([FileDigest.computeAsync(handle, Number(stats.size)), this.digestAsync(own)]);
      return digest === ownDigest;
    }
    finally {
      await handle.close();
    }
  }

  private async digestOwnAsync(): Promise<void> {
    const [program, archive] = await this.readOwnAsync();
    await Promise.all((Object.isNull(archive) ? [program] : [program, archive]).map(t => this.digestAsync(t)));
  }

  private readOwnAsync(): Promise<readonly [StampedFile, StampedFile | null]> {
    this.own ??= this.stampOwnAsync();
    return this.own;
  }

  private async stampOwnAsync(): Promise<readonly [StampedFile, StampedFile | null]> {
    const program = await stat(this.program, { bigint: true });
    const maps = path.posix.join(this.processFolder, Resources.ownProcessFolder, Resources.mapsFile);
    const archives = LinuxProgramIdentity.readArchives(await readFile(maps, Resources.utf8Encoding));
    const [archive] = archives;
    if (archives.length > 1 || archives.some(t => t.isDeleted))
      throw new RuntimeException(Resources.formatOwnArchiveUnusable(maps, archives.length));
    return [new StampedFile(this.program, program.dev, program.ino, program.size), Object.isUndefined(archive) ? null : await LinuxProgramIdentity.stampAsync(archive)];
  }

  private digestAsync(file: StampedFile): Promise<string> {
    const known = this.digests.get(file);
    if (!Object.isUndefined(known))
      return known;
    const digest = LinuxProgramIdentity.computeDigestAsync(file);
    this.digests.set(file, digest);
    return digest;
  }
}
