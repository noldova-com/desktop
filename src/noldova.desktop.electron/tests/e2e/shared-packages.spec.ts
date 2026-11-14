/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { expect, test } from "@playwright/test";

test.describe("one copy of the shared packages", () => {
  const root = path.resolve(import.meta.dirname, "../../../..");
  const windowApp = path.join(root, "src", "noldova.desktop.window.app");
  const scope = "@noldova";
  const scopes: readonly string[] = [scope, "@angular"];

  const locateAsync = async (from: string, name: string): Promise<string | null> => {
    for (let folder = from; ; folder = path.dirname(folder)) {
      const candidate = path.join(folder, "node_modules", ...name.split("/"));
      if (existsSync(path.join(candidate, "package.json")))
        return await realpath(candidate);
      if (path.dirname(folder) === folder)
        return null;
    }
  };
  const beaconWindow = `${scope}/desktop.fixture.packages.beacon.window`;

  const listAsync = async (folder: string): Promise<readonly string[]> => {
    const names: string[] = [];
    for (const each of scopes)
      if (existsSync(path.join(folder, "node_modules", each)))
        names.push(...(await readdir(path.join(folder, "node_modules", each))).map(t => `${each}/${t}`));
    return names;
  };
  const readManifestAsync = async (folder: string, name: string): Promise<JsonReader> =>
    JsonReader.parse(await readFile(path.join(folder, "node_modules", ...name.split("/"), "package.json"), "utf8"));
  const readNames = (manifest: JsonReader, field: string): readonly string[] => manifest.hasField(field) ? Object.keys(manifest.readObject(field).toJson()) : [];
  const listModulePackagesAsync = async (names: readonly string[]): Promise<readonly string[]> => {
    const modules: string[] = [];
    for (const name of names)
      if (readNames(await readManifestAsync(root, name), "exports").includes("./window"))
        modules.push(name);
    return modules;
  };
  const listWindowPackagesAsync = async (modules: readonly string[]): Promise<readonly string[]> => {
    const parts: string[] = [];
    for (const name of modules)
      parts.push(...readNames(await readManifestAsync(root, name), "dependencies"));
    return parts;
  };

  test("the context core resolves to the same folder from the window app, from the root and from the end-to-end tests", async () => {
    const name = "@noldova/context.core";
    const loaded = fileURLToPath(import.meta.resolve(name));

    const fromWindowApp = await locateAsync(windowApp, name);
    const fromRoot = await locateAsync(root, name);

    expect(fromRoot).not.toBeNull();
    expect(fromWindowApp).toBe(fromRoot);
    expect(path.relative(fromRoot ?? root, await realpath(loaded)).startsWith("..")).toBe(false);
  });

  test("the window app holds no package of its own, so the window, the runtime and the tests each find the one copy at the root", async () => {
    const atRoot = await listAsync(root);

    expect(await listAsync(windowApp)).toEqual([]);
    for (const name of atRoot)
      expect(await locateAsync(windowApp, name), name).toBe(await locateAsync(root, name));
  });

  test("the root install holds Angular and Noldova Desktop's window package once, and a module's window package beside them", async () => {
    const modulePackages = await listModulePackagesAsync((await listAsync(root)).filter(t => t.startsWith(`${scope}/`)));

    expect(await listWindowPackagesAsync(modulePackages)).toEqual([beaconWindow]);
    expect(existsSync(path.join(root, "node_modules", "@angular", "core"))).toBe(true);
    expect(existsSync(path.join(root, "node_modules", scope, "desktop.window"))).toBe(true);
  });

  test("no package of the runtime, the main process, the command line or the protocol lists an Angular package", async () => {
    for (const name of ["desktop.cli", "desktop.electron", "desktop.protocol", "desktop.runtime"].map(t => `${scope}/${t}`)) {
      const manifest = await readManifestAsync(root, name);
      expect(["dependencies", "optionalDependencies", "peerDependencies"].flatMap(t => readNames(manifest, t)).filter(t => t.startsWith("@angular/")), name).toEqual([]);
    }
  });
});
