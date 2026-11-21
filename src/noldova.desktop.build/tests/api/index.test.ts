/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import * as api from "@noldova/desktop.build";

@TestClass
export class BuildApiTests {
  private static readonly RELATIVE_IMPORT: RegExp = /(?:from\s*|import\s*\(\s*)"(\.{1,2}\/[^"]+)"/g;
  private static readonly ANY_IMPORT: RegExp = /^(?:import|export)\b[^"\n]*"([^"]+)";$|\bimport\(\s*"([^"]+)"\s*\)/gm;
  private static readonly RELEASE_ENTRY: readonly string[] = ["services", "release-command-line.js"];

  @TestMethod
  public exportsTheCompleteCatalog(): void {
    Assert.areEqual("BuildCommandLine", Object.keys(api).sort().join(","));
  }

  @TestMethod
  public async shipsOnlyJavaScriptImports(): Promise<void> {
    const folder = path.dirname(fileURLToPath(import.meta.resolve("@noldova/desktop.build/package.json")));
    const files = (await readdir(folder, { recursive: true })).filter(t => t.endsWith(".js"));
    const imports: string[] = [];
    for (const file of files)
      for (const match of (await readFile(path.join(folder, file), "utf8")).matchAll(BuildApiTests.RELATIVE_IMPORT))
        imports.push(String(match[1]));

    Assert.isTrue(files.length > 100, String(files.length));
    Assert.areEqual(String.empty, imports.filter(t => !t.endsWith(".js")).join(", "));
  }

  @TestMethod
  public async shipsAReleaseEntryThatLoadsOnlyNodesOwnModulesAndContext(): Promise<void> {
    const folder = path.dirname(fileURLToPath(import.meta.resolve("@noldova/desktop.build/package.json")));
    const bin = JsonReader.parse(await readFile(path.join(folder, "package.json"), "utf8")).readObject("bin");
    const pending = [path.join(folder, ...BuildApiTests.RELEASE_ENTRY)];
    const loaded = new Set<string>();
    const packages = new Set<string>();
    const contexts = new Set<string>();
    for (let file = pending.pop(); !Object.isUndefined(file); file = pending.pop()) {
      if (loaded.has(file))
        continue;
      loaded.add(file);
      for (const match of (await readFile(file, "utf8")).matchAll(BuildApiTests.ANY_IMPORT)) {
        const specifier = String(match[1] ?? match[2]);
        if (specifier.startsWith("."))
          pending.push(path.resolve(path.dirname(file), specifier));
        else if (specifier.startsWith("@noldova/context."))
          contexts.add(specifier);
        else if (!specifier.startsWith("node:"))
          packages.add(`${path.relative(folder, file)}: ${specifier}`);
      }
    }

    Assert.areEqual(`./${BuildApiTests.RELEASE_ENTRY.join("/")}`, bin.readString("noldova-desktop-release"));
    Assert.isTrue(loaded.size > 10, String(loaded.size));
    Assert.areEqual(String.empty, [...packages].join(", "));
    Assert.areEqual("@noldova/context.core, @noldova/context.exceptions, @noldova/context.json, @noldova/context.text", [...contexts].sort().join(", "));
  }

  @TestMethod
  public async declaresAsPeersEveryNoldovaPackageItsNoldovaPeersNeedFromTheLowestVersionTheyNeed(): Promise<void> {
    const folder = path.dirname(fileURLToPath(import.meta.resolve("@noldova/desktop.build/package.json")));
    const ranges = new Map(Object.entries(JsonReader.parse(await readFile(path.join(folder, "package.json"), "utf8")).readObject("peerDependencies").toJson())
      .filter((t): t is [string, string] => t[0].startsWith("@noldova/") && Object.isString(t[1])));
    const gaps: string[] = [];
    for (const peer of ranges.keys()) {
      const manifest = JsonReader.parse(await readFile(await BuildApiTests.manifestOfAsync(peer), "utf8"));
      for (const section of ["dependencies", "peerDependencies"].filter(t => manifest.hasField(t)))
        for (const [name, needed] of Object.entries(manifest.readObject(section).toJson()).filter(t => t[0].startsWith("@noldova/"))) {
          const range = ranges.get(name);
          if (Object.isUndefined(range) || BuildApiTests.lowestOf(range) < BuildApiTests.lowestOf(String(needed)))
            gaps.push(`${peer} needs ${name} ${String(needed)}, the build takes ${range ?? "none"}`);
        }
    }

    Assert.isTrue(ranges.size > 3, [...ranges.keys()].join(", "));
    Assert.areEqual(String.empty, gaps.sort().join("; "));
  }

  @TestMethod
  public async answersACommandTheReleaseEntryDoesNotRunWithItsUsage(): Promise<void> {
    const folder = path.dirname(fileURLToPath(import.meta.resolve("@noldova/desktop.build/package.json")));

    const result = spawnSync(process.execPath, [path.join(folder, ...BuildApiTests.RELEASE_ENTRY), "package"], { encoding: "utf8" });

    Assert.areEqual(2, result.status);
    Assert.areEqual("Usage: noldova-desktop-release <command> [<argument>...], where the command is one of list-targets, release-check, choose-feed, release-publish, release-lock, release-unlock, feed-check, module-range, noldova-desktop-range. "
      + "It loads only Node.js's own modules and the context packages desktop.build takes as peers, so it runs from desktop.build's archive with those beside it, without an install.\n", result.stderr);
  }

  @TestMethod
  public async runsEachReleaseCommandFromTheReleaseEntryUnderItsName(): Promise<void> {
    const folder = path.dirname(fileURLToPath(import.meta.resolve("@noldova/desktop.build/package.json")));

    const results = ["list-targets", "release-check", "choose-feed", "release-publish", "release-lock", "release-unlock", "feed-check", "module-range", "noldova-desktop-range"]
      .map(t => spawnSync(process.execPath, [path.join(folder, ...BuildApiTests.RELEASE_ENTRY), t, "extra", "more"], { encoding: "utf8" }));

    Assert.areEqual("2 noldova-desktop-release list-targets [<app folder>]\n2 noldova-desktop-release release-check\n2 noldova-desktop-release choose-feed\n2 noldova-desktop-release release-publish\n2 noldova-desktop-release release-lock\n2 noldova-desktop-release release-unlock\n2 noldova-desktop-release feed-check\n"
      + "2 noldova-desktop-release module-range <module folder>\n2 noldova-desktop-release noldova-desktop-range <lowest Noldova Desktop version>\n",
      results.map(t => `${t.status} ${t.stdout.slice(t.stdout.indexOf("noldova-desktop-release"))}`).join(String.empty));
  }

  private static lowestOf(range: string): string {
    return (/\d+\.\d+\.\d+/.exec(range)?.[0] ?? String.empty).split(".").map(t => t.padStart(6, "0")).join(".");
  }

  private static async manifestOfAsync(name: string): Promise<string> {
    for (let folder = path.dirname(fileURLToPath(import.meta.resolve(name))); folder !== path.dirname(folder); folder = path.dirname(folder)) {
      const file = path.join(folder, "package.json");
      const found = await readFile(file, "utf8").then(t => JsonReader.parse(t).readOptionalString("name"), () => undefined);
      if (found === name)
        return file;
    }
    throw new Error(`No package.json names ${name}.`);
  }
}
