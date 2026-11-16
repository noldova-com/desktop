/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { copyFile, link, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { PeerProcess } from "../../src/models/peer-process.js";
import { TemporaryFolderFixture } from "./temporary-folder.fixture.js";

export class LinuxProcessFolderFixture implements AsyncDisposable {
  public static readonly START: string = "88123";
  private static readonly NOISE: readonly string[] = [
    "00400000-00452000 r-xp 00000000 08:01 1234                               /usr/lib/x86_64-linux-gnu/libc.so.6",
    "7f0000000000-7f0000001000 rw-p 00000000 00:00 0 ",
    "7ffd00000000-7ffd00021000 rw-p 00000000 00:00 0                          [stack]",
    "00500000-00501000 r--p 00000000 08:01 99                                 /opt/other/app.asar.unpacked/addon.node"
  ];

  public readonly path: string;
  private readonly folder: TemporaryFolderFixture;
  private nextProcessId: number = 4120;

  private constructor(folder: TemporaryFolderFixture) {
    this.folder = folder;
    this.path = path.join(folder.path, "proc");
  }

  public static async createAsync(): Promise<LinuxProcessFolderFixture> {
    const fixture = new LinuxProcessFolderFixture(await TemporaryFolderFixture.createAsync());
    await mkdir(path.join(fixture.path, "self"), { recursive: true });
    await mkdir(path.join(fixture.folder.path, "files"));
    return fixture;
  }

  public static async lineAsync(file: string, suffix: string = ""): Promise<string> {
    const { dev, ino } = await stat(file, { bigint: true });
    const major = ((dev >> 8n) & 0xfffn) | ((dev >> 32n) & ~0xfffn);
    const minor = (dev & 0xffn) | ((dev >> 12n) & ~0xffn);
    return `7f1200000000-7f1200400000 r--p 00000000 ${major.toString(16).padStart(2, "0")}:${minor.toString(16).padStart(2, "0")} ${ino}                    ${file}${suffix}`;
  }

  public file(name: string): string {
    return path.join(this.folder.path, "files", name);
  }

  public async writeAsync(name: string, content: string): Promise<string> {
    await writeFile(this.file(name), content);
    return this.file(name);
  }

  public async writeArchiveAsync(folder: string, content: string): Promise<string> {
    await mkdir(this.file(folder));
    return await this.writeAsync(path.join(folder, "app.asar"), content);
  }

  public async writeOwnMapsAsync(...lines: readonly string[]): Promise<void> {
    await writeFile(path.join(this.path, "self", "maps"), [...LinuxProcessFolderFixture.NOISE, ...lines].join("\n"));
  }

  public async writePeerAsync(program: string, isSameFile: boolean, lines: readonly string[]): Promise<PeerProcess> {
    const processId = this.nextProcessId++;
    const folder = path.join(this.path, String(processId));
    await mkdir(folder);
    if (isSameFile)
      await link(program, path.join(folder, "exe"));
    else
      await copyFile(program, path.join(folder, "exe"));
    await this.writePeerMapsAsync(processId, lines);
    await this.writeStartAsync(processId, LinuxProcessFolderFixture.START);
    return new PeerProcess(path.posix.join(this.path, String(processId), "exe"), [], null, processId, LinuxProcessFolderFixture.START);
  }

  public async writePeerMapsAsync(processId: number, lines: readonly string[]): Promise<void> {
    await writeFile(path.join(this.path, String(processId), "maps"), [...LinuxProcessFolderFixture.NOISE, ...lines].join("\n"));
  }

  public async writeStartAsync(processId: number, start: string): Promise<void> {
    const fields = ["S", ...Array.from({ length: 18 }, () => "0"), start, "0", "0"];
    await writeFile(path.join(this.path, String(processId), "stat"), `${processId} (noldova desktop) ${fields.join(" ")}\n`);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.folder[Symbol.asyncDispose]();
  }
}
