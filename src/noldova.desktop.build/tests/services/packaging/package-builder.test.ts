/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import type { IBuilderRun } from "../../../src/interfaces/i-builder-run.js";
import { PackageBuilder } from "../../../src/services/packaging/package-builder.js";
import { PackageConfiguration } from "../../../src/services/packaging/package-configuration.js";

@TestClass
export class PackageBuilderTests {
  private static readonly ENTRY: string = "[Desktop Entry]\nName=Sample App\nExec=\"/opt/Sample App/sample-app\" %U\nIcon=sample-app\n";

  @TestMethod
  public passesTheConfigurationAndPublishesNothing(): void {
    const options = PackageBuilder.formatOptions(["/app/_build/package/electron-builder.json", "Sample Makers"]);
    const bare = PackageBuilder.formatOptions([]);

    Assert.areEqual("/app/_build/package/electron-builder.json never", `${String(options.config)} ${String(options.publish)}`);
    Assert.areEqual(String.empty, bare.config);
  }

  @TestMethod
  public movesTheDebianPackagesAppAndItsDesktopEntryIntoTheFolder(): Promise<void> {
    return PackageBuilderTests.runAsync(async desktopFile => {
      const packageArguments = ["--name", "sample-app", "/app/out/linux-unpacked/=/opt/Sample App", "/app/icons/512.png=/usr/share/icons/hicolor/512x512/apps/sample-app.png",
        `${desktopFile}=/usr/share/applications/sample-app.desktop`];

      const isDone = await PackageBuilder.formatOptions(["config.json", "Sample Makers"]).effectiveOptionComputed([packageArguments, desktopFile]);

      Assert.isFalse(isDone);
      Assert.areEqual("/app/out/linux-unpacked/=/opt/Sample Makers/Sample App", packageArguments[2]);
      Assert.areEqual("/app/icons/512.png=/usr/share/icons/hicolor/512x512/apps/sample-app.png", packageArguments[3]);
      Assert.areEqual(PackageBuilderTests.ENTRY.replace("Exec=\"/opt/", "Exec=\"/opt/Sample Makers/"), await readFile(desktopFile, "utf8"));
    });
  }

  @TestMethod
  public movesAnUnquotedExecLineToo(): Promise<void> {
    return PackageBuilderTests.runAsync(async desktopFile => {
      await writeFile(desktopFile, "[Desktop Entry]\nExec=/opt/SampleApp/sample-app %U\n");

      await new PackageBuilder("Sample$&Makers").computeAsync([["/app/out/linux-unpacked/=/opt/SampleApp"], desktopFile]);

      Assert.areEqual("[Desktop Entry]\nExec=/opt/Sample$&Makers/SampleApp/sample-app %U\n", await readFile(desktopFile, "utf8"));
    });
  }

  @TestMethod
  public leavesEveryCallAloneForAnAppThatNamesNoFolderOrThatIsNoDebianPackage(): Promise<void> {
    return PackageBuilderTests.runAsync(async desktopFile => {
      const packageArguments = ["/app/out/linux-unpacked/=/opt/Sample App"];
      const defines = { APP_FILENAME: "sample-app" };

      const results = [
        await new PackageBuilder(null).computeAsync([packageArguments, desktopFile]),
        await new PackageBuilder("Sample Makers").computeAsync({ args: packageArguments }),
        await new PackageBuilder("Sample Makers").computeAsync([defines, ["!define X"]]),
        await new PackageBuilder("Sample Makers").computeAsync([packageArguments, 42])
      ];

      Assert.areEqual("false,false,false,false", results.join(","));
      Assert.areEqual("/app/out/linux-unpacked/=/opt/Sample App", packageArguments[0]);
      Assert.areEqual(PackageBuilderTests.ENTRY, await readFile(desktopFile, "utf8"));
    });
  }

  @TestMethod
  public keepsTheArgumentsOfAnAppThatNamesNoFolderByteForByte(): Promise<void> {
    return PackageBuilderTests.runAsync(async desktopFile => {
      const packageArguments = ["-s", "dir", "--force", "-t", "deb", "-d", "libgtk-3-0", "--deb-priority", "optional", "--architecture", "amd64",
        "--after-install", "/tmp/after-install.sh", "--after-remove", "/tmp/after-remove.sh", "--name", "sample-app", "--version", "1.2.3",
        "/app/out/linux-unpacked/=/opt/Sample App", `${desktopFile}=/usr/share/applications/sample-app.desktop`];
      const before = JSON.stringify(packageArguments);

      const isDone = await PackageBuilder.formatOptions(["config.json"]).effectiveOptionComputed([packageArguments, desktopFile]);

      Assert.isFalse(isDone);
      Assert.areEqual(before, JSON.stringify(packageArguments));
      Assert.areEqual(PackageBuilderTests.ENTRY, await readFile(desktopFile, "utf8"));
    });
  }

  @TestMethod
  public async runsTheBuildersBuildWithItsOptionsAndRefusesExportsWithoutOne(): Promise<void> {
    const runs: string[] = [];
    const exports = { build: async (options: IBuilderRun): Promise<null> => {
      runs.push(`${options.config} ${options.publish}`);
      return null;
    } };

    await PackageBuilder.runAsync(exports, ["/app/_build/package/electron-builder.json"]);
    const refusal = await Assert.throwsAsync(() => PackageBuilder.runAsync({ build: "electron-builder" }, []), BuildException);

    Assert.areEqual("/app/_build/package/electron-builder.json never", runs.join("|"));
    Assert.areEqual("electron-builder exports no build function, so the package cannot be built.", refusal.message);
  }

  @TestMethod
  public async takesElectronBuilderFromTheAppsRootAndFailsWhereTheAppHasNone(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "package-builder-root-"));
    try {
      const builder = fileURLToPath(PackageBuilder.locateBuilder(process.cwd()));

      Assert.areEqual(path.dirname(fileURLToPath(import.meta.resolve("electron-builder"))), path.dirname(builder));
      Assert.throws(() => PackageBuilder.locateBuilder(folder), Error);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async checksTheElectronBuilderWhoseDebianArgumentsAndTemplatesItRewrites(): Promise<void> {
    const library = path.resolve(PackageConfiguration.locateBuilderTemplates(), "..", "..", "package.json");
    const builder = path.resolve(path.dirname(fileURLToPath(import.meta.resolve("electron-builder"))), "..", "package.json");
    const versions: string[] = [];
    for (const manifest of [builder, library])
      versions.push(JsonReader.parse(await readFile(manifest, "utf8")).readString("version"));

    Assert.areEqual("26.16.1 26.16.1", versions.join(" "), "electron-builder moved: check that its Debian package still maps the app to /opt/<product> in fpm's "
      + "arguments and its desktop entry, and that templates/linux after-install.tpl, after-remove.tpl and apparmor-profile.tpl still name /opt/<sanitizedProductName>/, "
      + "then set the version here.");
  }

  @TestMethod
  public refusesAPackageWhoseAppOrDesktopEntryItCantPlace(): Promise<void> {
    return PackageBuilderTests.runAsync(async desktopFile => {
      const unmapped = await Assert.throwsAsync(() => new PackageBuilder("Sample Makers").computeAsync([["/app/out/linux-unpacked/=/usr/lib/Sample App"], desktopFile]),
        BuildException);
      await writeFile(desktopFile, "[Desktop Entry]\nExec=/usr/bin/sample-app\n");
      const unrun = await Assert.throwsAsync(() => new PackageBuilder("Sample Makers").computeAsync([["/app/out/linux-unpacked/=/opt/Sample App"], desktopFile]),
        BuildException);

      for (const refusal of [unmapped, unrun])
        Assert.areEqual(`electron-builder's Debian package arguments map no app folder into /opt, or its desktop entry ${desktopFile} runs no program there, `
          + "so the package can't move them into /opt/Sample Makers.", refusal.message);
    });
  }

  private static async runAsync(test: (desktopFile: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "package-builder-"));
    try {
      const desktopFile = path.join(folder, "sample-app.desktop");
      await writeFile(desktopFile, PackageBuilderTests.ENTRY);
      await test(desktopFile);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
