/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
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
  private static readonly TARGET: string = "posix_process";
  private static readonly NO_NPM: string = "npm_execpath is not set; run the tests through npm test.";
  private static readonly TIMEOUT: number = 25_000;

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
      "--devdir", path.join(root, ...PosixAddonVariantFixture.HEADERS_SEGMENTS)
    ], { cwd: folder, timeout: PosixAddonVariantFixture.TIMEOUT });
    return path.join(folder, "build", "Release", `${PosixAddonVariantFixture.TARGET}.node`);
  }

  public static async readImportsAsync(addon: string): Promise<readonly string[]> {
    const { stdout } = await promisify(execFile)("nm", ["-D", "--undefined-only", addon], { encoding: "utf8", timeout: PosixAddonVariantFixture.TIMEOUT });
    return stdout.split("\n").map(t => t.trim().split(/\s+/).at(-1)?.split("@")[0] ?? String.empty).filter(t => t.length > 0);
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
