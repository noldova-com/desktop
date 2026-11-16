/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { link, mkdir, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { PeerProcess } from "../../src/models/peer-process.js";
import { TemporaryFolderFixture } from "./temporary-folder.fixture.js";

export class LinuxProcessFolderFixture implements AsyncDisposable {
  public static readonly START: string = "88123";
  private static readonly WRITTEN: Date = new Date(Date.UTC(2026, 0, 1));
  private static readonly MOUNTS: readonly string[] = [
    "22 1 4094:77 / /proc rw,nosuid shared:12 - proc proc rw",
    "unreadable line"
  ];

  public readonly path: string;
  private readonly folder: TemporaryFolderFixture;
  private readonly links: Map<string, string | Error> = new Map();
  private nextProcessId: number = 4120;

  public readonly readLink = (file: string): Promise<string> => {
    const target = this.links.get(file) ?? Object.assign(new Error(`${file} was closed.`), { code: "ENOENT" });
    return target instanceof Error ? Promise.reject(target) : Promise.resolve(target);
  };

  private constructor(folder: TemporaryFolderFixture) {
    this.folder = folder;
    this.path = path.join(folder.path, "proc");
  }

  public static async createAsync(): Promise<LinuxProcessFolderFixture> {
    const fixture = new LinuxProcessFolderFixture(await TemporaryFolderFixture.createAsync());
    await mkdir(path.join(fixture.path, "self"), { recursive: true });
    await mkdir(path.join(fixture.folder.path, "files"));
    await fixture.writeMountsAsync(null);
    return fixture;
  }

  public file(name: string): string {
    return path.join(this.folder.path, "files", name);
  }

  public async writeAsync(name: string, content: string): Promise<string> {
    const file = this.file(name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
    await utimes(file, LinuxProcessFolderFixture.WRITTEN, LinuxProcessFolderFixture.WRITTEN);
    return file;
  }

  public async writeAppAsync(name: string, archive: string | null, program: string = "electron"): Promise<readonly [string, string]> {
    const archiveFile = Object.isNull(archive) ? this.file(path.join(name, "resources", "app.asar")) : await this.writeAsync(path.join(name, "resources", "app.asar"), archive);
    return [await this.writeAsync(path.join(name, "program"), program), archiveFile];
  }

  public async writeMountsAsync(options: string | null): Promise<void> {
    const { dev } = await stat(this.file(""), { bigint: true });
    const major = ((dev >> 8n) & 0xfffn) | ((dev >> 32n) & ~0xfffn);
    const minor = (dev & 0xffn) | ((dev >> 12n) & ~0xffn);
    const own = Object.isNull(options) ? [] : [`36 25 ${major}:${minor} / /files rw,relatime shared:1 - ext4 /dev/files ${options}`];
    await writeFile(path.join(this.path, "self", "mountinfo"), [...LinuxProcessFolderFixture.MOUNTS, ...own, ""].join("\n"));
  }

  public setLink(file: string, target: string | Error): void {
    this.links.set(file, target);
  }

  public async writePeerAsync(program: string, archives: readonly string[] = [], target: string = program): Promise<PeerProcess> {
    const processId = this.nextProcessId++;
    const folder = path.join(this.path, String(processId));
    await mkdir(path.join(folder, "fd"), { recursive: true });
    await link(program, path.join(folder, "exe"));
    this.setLink(path.join(folder, "exe"), target);
    await writeFile(path.join(folder, "fd", "0"), "");
    this.setLink(path.join(folder, "fd", "0"), "/dev/null");
    await writeFile(path.join(folder, "fd", "1"), "");
    const peer = new PeerProcess(path.join(folder, "exe"), [], null, processId, LinuxProcessFolderFixture.START);
    for (const archive of archives)
      await this.addDescriptorAsync(peer, archive);
    await this.writeStartAsync(processId, LinuxProcessFolderFixture.START);
    return peer;
  }

  public async addDescriptorAsync(peer: PeerProcess, file: string, target: string = file): Promise<string> {
    const folder = path.join(this.path, String(peer.processId), "fd");
    const descriptor = path.join(folder, String(this.links.size + 3));
    await link(file, descriptor);
    this.setLink(descriptor, target);
    return descriptor;
  }

  public async writeStartAsync(processId: number, start: string): Promise<void> {
    const fields = ["S", ...Array.from({ length: 18 }, () => "0"), start, "0", "0"];
    await writeFile(path.join(this.path, String(processId), "stat"), `${processId} (noldova desktop) ${fields.join(" ")}\n`);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.folder[Symbol.asyncDispose]();
  }
}
