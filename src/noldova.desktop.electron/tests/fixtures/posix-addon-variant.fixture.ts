/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import "@noldova/context.core";
import { Assert } from "@noldova/context.testing";
import { NativeAddon } from "@noldova/desktop.runtime";

export class PosixAddonVariantFixture {
  public static readonly BUILT: string = "built";
  public static readonly NO_SYS_NUMBER: string = "no SYS_close_range";
  public static readonly NO_NUMBERS: string = "no SYS_close_range or __NR_close_range";
  public static readonly ENOSYS: string = "close_range failing with ENOSYS";
  public static readonly SPAWN_FAILURE_HOOK: string = "the test hook that can make the disclaimed spawn fail";
  private static readonly SHIMS: ReadonlyMap<string, readonly string[]> = new Map([
    [PosixAddonVariantFixture.NO_SYS_NUMBER, ["#undef SYS_close_range"]],
    [PosixAddonVariantFixture.NO_NUMBERS, ["#undef SYS_close_range", "#undef __NR_close_range"]],
    [PosixAddonVariantFixture.ENOSYS, ["#undef SYS_close_range", "#define SYS_close_range (-1)"]],
    [PosixAddonVariantFixture.SPAWN_FAILURE_HOOK, []]
  ]);
  private static readonly DEFINES: ReadonlyMap<string, readonly string[]> = new Map([
    [PosixAddonVariantFixture.SPAWN_FAILURE_HOOK, ["NOLDOVA_SPAWN_FAILURE_HOOK"]]
  ]);
  private static readonly SHIM_FOLDER: string = "shim";
  private static readonly SOURCE_SEGMENTS: readonly string[] = ["src", "noldova.desktop.runtime", "src", "native", "posix-process.c"];
  private static readonly NODE_GYP_SEGMENTS: readonly string[] = ["..", "node_modules", "node-gyp", "bin", "node-gyp.js"];
  private static readonly HEADERS_SEGMENTS: readonly string[] = ["_build", "node-gyp"];
  private static readonly LOCAL_HEADERS_SEGMENTS: readonly string[] = ["include", "node", "common.gypi"];
  private static readonly TARGET: string = "posix_process";
  private static readonly NO_NPM: string = "npm_execpath is not set; run the tests through npm test.";
  private static readonly ELF_MAGIC: number = 0x7f454c46;
  private static readonly ELF_CLASS: number = 4;
  private static readonly ELF_64_BIT: number = 2;
  private static readonly ELF_ENCODING: number = 5;
  private static readonly ELF_LITTLE_ENDIAN: number = 1;
  private static readonly SECTION_TABLE_OFFSET: number = 0x28;
  private static readonly SECTION_ENTRY_SIZE_OFFSET: number = 0x3a;
  private static readonly SECTION_COUNT_OFFSET: number = 0x3c;
  private static readonly SECTION_TYPE: number = 4;
  private static readonly SECTION_OFFSET: number = 24;
  private static readonly SECTION_SIZE: number = 32;
  private static readonly SECTION_LINK: number = 40;
  private static readonly DYNAMIC_SYMBOLS: number = 11;
  private static readonly SYMBOL_SIZE: number = 24;
  private static readonly SYMBOL_SECTION: number = 6;
  private static readonly UNDEFINED_SECTION: number = 0;

  public static async buildAsync(variant: string, folder: string): Promise<string> {
    if (variant === PosixAddonVariantFixture.BUILT)
      return NativeAddon.locate("posix-process.node");
    const shim = PosixAddonVariantFixture.SHIMS.get(variant);
    if (Object.isUndefined(shim))
      Assert.fail(`No addon variant is named "${variant}".`);
    const npm = process.env["npm_execpath"];
    if (Object.isUndefined(npm) || npm.length === 0)
      Assert.fail(PosixAddonVariantFixture.NO_NPM);
    const root = PosixAddonVariantFixture.findRoot();
    await copyFile(path.join(root, ...PosixAddonVariantFixture.SOURCE_SEGMENTS), path.join(folder, "posix-process.c"));
    await mkdir(path.join(folder, PosixAddonVariantFixture.SHIM_FOLDER, "sys"), { recursive: true });
    await writeFile(path.join(folder, PosixAddonVariantFixture.SHIM_FOLDER, "sys", "syscall.h"), ["#include_next <sys/syscall.h>", ...shim, String.empty].join("\n"));
    await writeFile(path.join(folder, "binding.gyp"), JSON.stringify({
      targets: [{ target_name: PosixAddonVariantFixture.TARGET, sources: ["posix-process.c"], include_dirs: [PosixAddonVariantFixture.SHIM_FOLDER],
        defines: ["NAPI_VERSION=8", ...PosixAddonVariantFixture.DEFINES.get(variant) ?? []] }]
    }));
    await promisify(execFile)(process.execPath, [
      path.join(path.dirname(String(npm)), ...PosixAddonVariantFixture.NODE_GYP_SEGMENTS), "rebuild", "--loglevel=error", "--enable-lto=false", "--enable-thin-lto=false",
      ...PosixAddonVariantFixture.locateHeaders(root)
    ], { cwd: folder });
    return path.join(folder, "build", "Release", `${PosixAddonVariantFixture.TARGET}.node`);
  }

  public static async readImportsAsync(addon: string): Promise<readonly string[]> {
    const file = await readFile(addon);
    if (file.readUInt32BE(0) !== PosixAddonVariantFixture.ELF_MAGIC || file[PosixAddonVariantFixture.ELF_CLASS] !== PosixAddonVariantFixture.ELF_64_BIT
      || file[PosixAddonVariantFixture.ELF_ENCODING] !== PosixAddonVariantFixture.ELF_LITTLE_ENDIAN)
      Assert.fail(`${addon} is not a 64-bit little-endian ELF file.`);
    const table = Number(file.readBigUInt64LE(PosixAddonVariantFixture.SECTION_TABLE_OFFSET));
    const entrySize = file.readUInt16LE(PosixAddonVariantFixture.SECTION_ENTRY_SIZE_OFFSET);
    const sections = Array.from({ length: file.readUInt16LE(PosixAddonVariantFixture.SECTION_COUNT_OFFSET) }, (_, i) => table + i * entrySize);
    const symbols = sections.find(t => file.readUInt32LE(t + PosixAddonVariantFixture.SECTION_TYPE) === PosixAddonVariantFixture.DYNAMIC_SYMBOLS);
    if (Object.isUndefined(symbols))
      Assert.fail(`${addon} has no dynamic symbol table.`);
    const names = Number(file.readBigUInt64LE(table + file.readUInt32LE(symbols + PosixAddonVariantFixture.SECTION_LINK) * entrySize + PosixAddonVariantFixture.SECTION_OFFSET));
    const first = Number(file.readBigUInt64LE(symbols + PosixAddonVariantFixture.SECTION_OFFSET));
    const count = Number(file.readBigUInt64LE(symbols + PosixAddonVariantFixture.SECTION_SIZE)) / PosixAddonVariantFixture.SYMBOL_SIZE;
    return Array.from({ length: count }, (_, i) => first + i * PosixAddonVariantFixture.SYMBOL_SIZE)
      .filter(t => file.readUInt16LE(t + PosixAddonVariantFixture.SYMBOL_SECTION) === PosixAddonVariantFixture.UNDEFINED_SECTION && file.readUInt32LE(t) > 0)
      .map(t => names + file.readUInt32LE(t))
      .map(t => file.toString("latin1", t, file.indexOf(0, t)));
  }

  private static locateHeaders(root: string): readonly string[] {
    const node = path.dirname(path.dirname(process.execPath));
    return existsSync(path.join(node, ...PosixAddonVariantFixture.LOCAL_HEADERS_SEGMENTS))
      ? ["--nodedir", node]
      : ["--devdir", path.join(root, ...PosixAddonVariantFixture.HEADERS_SEGMENTS)];
  }

  private static findRoot(): string {
    let folder = path.dirname(fileURLToPath(import.meta.url));
    while (!existsSync(path.join(folder, ...PosixAddonVariantFixture.SOURCE_SEGMENTS))) {
      const parent = path.dirname(folder);
      if (parent === folder)
        Assert.fail("The repository holding the POSIX addon's source was not found above the tests.");
      folder = parent;
    }
    return folder;
  }
}
