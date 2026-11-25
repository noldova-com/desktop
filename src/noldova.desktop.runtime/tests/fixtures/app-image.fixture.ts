/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";

import { AppImageProgramNotStartedException } from "../exceptions/app-image-program-not-started.exception.js";
import { WaitFixture } from "./wait.fixture.js";

export class AppImageFixture implements AsyncDisposable {
  public static readonly END_SIGNAL_EXIT: number = 7;

  private static readonly IMAGE: string = [
    "#!/bin/bash",
    "here=${0%/*}",
    "case $1 in",
    "  --appimage-mount)",
    "    if [[ -e $here/refuse-mount ]]; then exit 1; fi",
    "    mount=$here/mount-$$",
    "    cp -R -- \"$here/payload\" \"$mount\"",
    "    exec 3< <(trap '' PIPE; while printf x 2> /dev/null; do :; done; rm -rf -- \"$mount\")",
    "    for open in /proc/$$/fd/*; do case ${open##*/} in 0|1|2|3|255) ;; *) eval \"exec ${open##*/}<&-\" ;; esac; done",
    "    echo \"$mount\"",
    "    while :; do sleep 0.05; done",
    "    ;;",
    "  --appimage-extract)",
    "    if [[ -e $here/refuse-extract ]]; then exit 1; fi",
    "    cp -R -- \"$here/payload\" squashfs-root",
    "    ;;",
    "esac",
    String.empty
  ].join("\n");
  private static readonly PROGRAM: string = [
    "#!/bin/bash",
    "printf '%s|' \"$0\" \"$@\" \"$APPDIR\" > \"$NOLDOVA_DESKTOP_FIXTURE_RECORD\"",
    "if [[ $1 == wait ]]; then",
    `  trap 'exit ${AppImageFixture.END_SIGNAL_EXIT}' TERM`,
    "  : > \"$NOLDOVA_DESKTOP_FIXTURE_RECORD.started.part\"",
    "  mv \"$NOLDOVA_DESKTOP_FIXTURE_RECORD.started.part\" \"$NOLDOVA_DESKTOP_FIXTURE_RECORD.started\"",
    "  while :; do sleep 0.05; done",
    "fi",
    "exit \"${NOLDOVA_DESKTOP_FIXTURE_EXIT:-0}\"",
    String.empty
  ].join("\n");
  private static readonly EXECUTABLE_MODE: number = 0o755;
  private static readonly WAIT_LIMIT: number = 10_000;

  public readonly folder: string;

  private constructor(folder: string) {
    this.folder = folder;
  }

  public get image(): string {
    return path.join(this.folder, "fixture.AppImage");
  }

  public get root(): string {
    return path.join(this.folder, "client");
  }

  public get program(): string {
    return path.join(this.root, "noldova-desktop");
  }

  public get record(): string {
    return path.join(this.folder, "record");
  }

  public get copyRecord(): string {
    return path.join(this.folder, "copy.log");
  }

  public get temporary(): string {
    return path.join(this.folder, "temporary");
  }

  public static async createAsync(): Promise<AppImageFixture> {
    const fixture = new AppImageFixture(await mkdtemp(path.join(tmpdir(), "nol-app-image-")));
    await mkdir(path.join(fixture.folder, "payload"), { recursive: true });
    await mkdir(fixture.root, { recursive: true });
    await mkdir(fixture.temporary, { recursive: true });
    await writeFile(fixture.image, AppImageFixture.IMAGE);
    await writeFile(path.join(fixture.folder, "payload", "noldova-desktop"), AppImageFixture.PROGRAM);
    await chmod(fixture.image, AppImageFixture.EXECUTABLE_MODE);
    await chmod(path.join(fixture.folder, "payload", "noldova-desktop"), AppImageFixture.EXECUTABLE_MODE);
    return fixture;
  }

  public async refuseAsync(option: "mount" | "extract"): Promise<void> {
    await writeFile(path.join(this.folder, `refuse-${option}`), String.empty);
  }

  public async listMountsAsync(): Promise<string[]> {
    return (await readdir(this.folder)).filter(t => t.startsWith("mount-"));
  }

  public async listExtractionsAsync(): Promise<string[]> {
    return readdir(this.temporary);
  }

  public async readRecordAsync(): Promise<string> {
    return readFile(this.record, "utf8");
  }

  public async waitForProgramAsync(): Promise<void> {
    if (!await WaitFixture.untilAsync(() => existsSync(`${this.record}.started`), AppImageFixture.WAIT_LIMIT))
      throw new AppImageProgramNotStartedException(AppImageFixture.WAIT_LIMIT);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await rm(this.folder, { recursive: true, force: true });
  }
}
