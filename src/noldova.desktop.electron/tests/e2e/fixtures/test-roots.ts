/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { DataDirectory, RuntimeServer } from "@noldova/desktop.runtime";

import { CleanupSteps } from "./cleanup-steps.ts";
import { ErrorCodeFixture } from "./error-code.fixture.ts";
import { UiRun } from "./ui-run.ts";
import { WholeFile } from "./whole-file.ts";

export interface IMarkedTestRoot {
  readonly root: string;
  readonly run: UiRun;
}

export class TestRoots {
  public static readonly MARKER: string = "ui-run";

  private static readonly ROOT_PREFIX: string = "desktop-ui-w";
  private static readonly STAGING_PREFIX: string = "desktop-ui-new-";
  private static readonly RUN_FOLDER_PREFIX: string = "ui-run-";
  private static readonly ROOT_NAME: RegExp = /^desktop-ui-w\d+-[A-Za-z0-9]{6}$/;
  private static readonly STAGING_NAME: RegExp = /^desktop-ui-new-[A-Za-z0-9]{6}$/;
  private static readonly RUN_FOLDER_NAME: RegExp = /^ui-run-[A-Za-z0-9]{6}$/;
  private static readonly SHORT_BASE: string = "/tmp";
  private static readonly UNIQUE_PART: string = "XXXXXX";
  private static readonly SOCKET_FILE: string = "runtime.sock";
  private static readonly REMOVED_NAME: RegExp = /^desktop-ui-(?:w\d+|new)-[A-Za-z0-9]{6}\.removed$/;
  private static readonly REMOVED_SUFFIX: string = ".removed";
  private static readonly DATA_FOLDER: string = "data";
  private static readonly NO_SUCH_FILE: string = "ENOENT";
  private static readonly TEMPORARY_VARIABLES: readonly string[] = ["TMPDIR", "TEMP", "TMP"];
  private static readonly BASE_VARIABLE: string = "NOLDOVA_DESKTOP_UI_TEMPORARY_BASE";
  private static readonly RUN_FOLDER_VARIABLE: string = "NOLDOVA_DESKTOP_UI_RUN_FOLDER";
  private static readonly RUN_FOLDER_RETRIES: number = 3;

  public readonly marked: readonly IMarkedTestRoot[];
  public readonly unmarked: readonly string[];
  public readonly staging: readonly string[];
  public readonly removed: readonly string[];
  public readonly runFolders: readonly IMarkedTestRoot[];

  private constructor(marked: readonly IMarkedTestRoot[], unmarked: readonly string[], staging: readonly string[], removed: readonly string[], runFolders: readonly IMarkedTestRoot[]) {
    this.marked = marked;
    this.unmarked = unmarked;
    this.staging = staging;
    this.removed = removed;
    this.runFolders = runFolders;
  }

  public static get base(): string {
    return process.env[TestRoots.BASE_VARIABLE] ?? TestRoots.runBase;
  }

  public static get runBase(): string {
    return TestRoots.baseFor(os.tmpdir());
  }

  public static forgetRunFolder(): void {
    delete process.env[TestRoots.RUN_FOLDER_VARIABLE];
    delete process.env[TestRoots.BASE_VARIABLE];
  }

  public static baseFor(given: string, platform: NodeJS.Platform = process.platform): string {
    return platform === "win32" || TestRoots.RUN_FOLDER_NAME.test(path.basename(given)) ? given : TestRoots.SHORT_BASE;
  }

  public static runFolderIn(base: string): string {
    return path.join(base, `${TestRoots.RUN_FOLDER_PREFIX}${TestRoots.UNIQUE_PART}`);
  }

  public static longestSocketPath(runFolder: string, workers: number): string {
    const root = path.join(runFolder, `${TestRoots.ROOT_PREFIX}${workers - 1}-${TestRoots.UNIQUE_PART}`);
    return path.join(new DataDirectory(TestRoots.dataDirectoryOf(root)).discoveryFolder, TestRoots.SOCKET_FILE);
  }

  public static checkSocketPath(workers: number, given: string = os.tmpdir(), platform: NodeJS.Platform = process.platform): void {
    if (platform === "win32")
      return;
    const longest = TestRoots.longestSocketPath(TestRoots.runFolderIn(TestRoots.baseFor(given, platform)), workers);
    const length = Buffer.byteLength(longest);
    if (length > RuntimeServer.maximumSocketPathLength)
      throw new Error(`A test of this run would start the runtime with the socket path ${longest}, which is ${length} bytes, over the ${RuntimeServer.maximumSocketPathLength} the runtime accepts, so the run stops before its tests; run it from a shorter temporary folder.`);
  }

  public static async useRunFolderAsync(run: UiRun): Promise<string> {
    const base = TestRoots.runBase;
    const folder = await mkdtemp(path.join(base, TestRoots.RUN_FOLDER_PREFIX));
    await WholeFile.writeAsync(path.join(folder, TestRoots.MARKER), run.id);
    process.env[TestRoots.BASE_VARIABLE] = base;
    process.env[TestRoots.RUN_FOLDER_VARIABLE] = folder;
    for (const name of TestRoots.TEMPORARY_VARIABLES)
      process.env[name] = folder;
    return folder;
  }

  public static async removeOwnRunFolderAsync(): Promise<void> {
    const folder = process.env[TestRoots.RUN_FOLDER_VARIABLE];
    if (!Object.isUndefined(folder) && TestRoots.RUN_FOLDER_NAME.test(path.basename(folder)))
      await TestRoots.removeRunFolderAsync(folder);
  }

  public static async removeRunFolderAsync(folder: string): Promise<void> {
    const names = await readdir(folder).catch((error: unknown) => {
      if (ErrorCodeFixture.of(error) === TestRoots.NO_SUCH_FILE)
        return null;
      throw error;
    });
    if (Object.isNull(names) || names.some(t => TestRoots.ROOT_NAME.test(t) || TestRoots.STAGING_NAME.test(t)))
      return;
    await rm(folder, { recursive: true, force: true, maxRetries: TestRoots.RUN_FOLDER_RETRIES }).catch((error: unknown) => {
      throw new Error(`Deleting the run's temporary folder ${folder} failed, so the next UI run's set-up tries again: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    });
  }

  public static async createAsync(run: UiRun, parallelIndex: number): Promise<string> {
    const staging = await mkdtemp(path.join(os.tmpdir(), TestRoots.STAGING_PREFIX));
    await WholeFile.writeAsync(path.join(staging, TestRoots.MARKER), run.id);
    const root = path.join(os.tmpdir(), `${TestRoots.ROOT_PREFIX}${parallelIndex}-${path.basename(staging).slice(TestRoots.STAGING_PREFIX.length)}`);
    await WholeFile.renameAsync(staging, root);
    return root;
  }

  public static dataDirectoryOf(root: string): string {
    return path.join(root, TestRoots.DATA_FOLDER);
  }

  public static async removeAsync(root: string, maxRetries: number = 0): Promise<void> {
    const removed = `${root}${TestRoots.REMOVED_SUFFIX}`;
    await WholeFile.renameAsync(root, removed).catch((error: unknown) => {
      if (ErrorCodeFixture.of(error) !== TestRoots.NO_SUCH_FILE)
        throw error;
    });
    await TestRoots.deleteAsync(removed, maxRetries);
  }

  public static async scanAsync(base: string = os.tmpdir()): Promise<TestRoots> {
    const runFolders: IMarkedTestRoot[] = [];
    const unmarkedRunFolders: string[] = [];
    for (const name of (await readdir(base)).sort().filter(t => TestRoots.RUN_FOLDER_NAME.test(t))) {
      const folder = path.join(base, name);
      const run = await TestRoots.readMarkerAsync(folder);
      if (!Object.isNull(run))
        runFolders.push({ root: folder, run });
      else if (existsSync(folder))
        unmarkedRunFolders.push(folder);
    }
    const marked: IMarkedTestRoot[] = [];
    const unmarked: string[] = [];
    const staging: string[] = [];
    const removed: string[] = [];
    for (const folder of [base, ...runFolders.map(t => t.root)]) {
      const names = (await TestRoots.readNamesAsync(folder)).sort();
      for (const name of names.filter(t => TestRoots.ROOT_NAME.test(t) || TestRoots.STAGING_NAME.test(t))) {
        const root = path.join(folder, name);
        const run = await TestRoots.readMarkerAsync(root);
        if (!Object.isNull(run))
          marked.push({ root, run });
        else if (existsSync(root))
          (TestRoots.ROOT_NAME.test(name) ? unmarked : staging).push(root);
      }
      removed.push(...names.filter(t => TestRoots.REMOVED_NAME.test(t)).map(t => path.join(folder, t)));
    }
    return new TestRoots(marked, unmarked, [...staging, ...unmarkedRunFolders], removed, runFolders);
  }

  public static async deleteRemovedAsync(base: string = os.tmpdir()): Promise<readonly string[]> {
    const removed = (await TestRoots.scanAsync(base)).removed;
    const failures = await CleanupSteps.collectFailuresAsync(removed.map(t => () => TestRoots.deleteAsync(t, 0)));
    return failures.map(t => t instanceof Error ? t.message : String(t));
  }

  private static async readNamesAsync(folder: string): Promise<string[]> {
    return await readdir(folder).catch((error: unknown) => {
      if (ErrorCodeFixture.of(error) === TestRoots.NO_SUCH_FILE)
        return [];
      throw error;
    });
  }

  private static readMarkerAsync(folder: string): Promise<UiRun | null> {
    return readFile(path.join(folder, TestRoots.MARKER), "utf8").then(t => UiRun.parse(t), () => null);
  }

  private static async deleteAsync(removed: string, maxRetries: number): Promise<void> {
    await rm(removed, { recursive: true, force: true, maxRetries }).catch((error: unknown) => {
      throw new Error(`Deleting ${removed} failed, so the next UI run's set-up tries again: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    });
  }
}
