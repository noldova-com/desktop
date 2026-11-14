/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackageManifest } from "../../../src/models/packages/package-manifest.js";
import { Resources } from "../../../src/resources.js";
import { BuildLayout } from "../../../src/services/packages/build-layout.js";

@TestClass
export class BuildLayoutTests {
  private static readonly ROOT: string = path.join(tmpdir(), "build-layout-root");
  private static readonly MANIFEST: PackageManifest = new PackageManifest("src/noldova.desktop.protocol", "@noldova/desktop.protocol", []);

  @TestMethod
  public locatesTheBuildsFoldersAndFilesUnderTheRoot(): void {
    const layout = new BuildLayout(BuildLayoutTests.ROOT);
    const manifest = BuildLayoutTests.MANIFEST;
    const root = BuildLayoutTests.ROOT;

    Assert.areEqual(root, layout.root);
    Assert.areEqual(path.join(root, "_packages"), layout.archivesFolder);
    Assert.areEqual(path.join(root, "_build", "node-gyp"), layout.nodeGypFolder);
    Assert.areEqual(path.join(root, "_build", "records", "window-install.txt"), layout.windowInstallRecord);
    Assert.areEqual(path.join(root, "src", "noldova.desktop.protocol", "src", "index.ts"), layout.locateSource(manifest, "src", "index.ts"));
    Assert.areEqual(path.join(root, "_build", "packages", manifest.id), layout.locateOutput(manifest));
    Assert.areEqual(path.join(root, "_build", "native", manifest.id, "pty"), layout.locateAddonWork(manifest, "pty"));
    Assert.areEqual(path.join(root, "_build", "tests", manifest.id), layout.locateTestOutput(manifest));
    Assert.areEqual(path.join(root, "_build", "records", Resources.formatRecordFile(manifest.id)), layout.locateRecord(manifest));
    Assert.areEqual(path.join(root, "_build", "records", Resources.formatTestRecordFile(manifest.id)), layout.locateTestRecord(manifest));
    Assert.areEqual(path.join(root, "node_modules", "@noldova", "desktop.protocol"), layout.locateInstalled(manifest));
    Assert.areEqual(path.join(root, "node_modules", "plain"), layout.locateInstalledPackage("plain"));
  }

  @TestMethod
  public namesArchivesWithTheScopeJoinedToTheName(): void {
    const layout = new BuildLayout(BuildLayoutTests.ROOT);

    Assert.areEqual(Resources.formatArchiveName("noldova-desktop.protocol", "1.2.3"), BuildLayout.nameArchive("@noldova/desktop.protocol", "1.2.3"));
    Assert.areEqual(Resources.formatArchiveName("plain", "1.2.3"), BuildLayout.nameArchive("plain", "1.2.3"));
    Assert.areEqual(path.join(BuildLayoutTests.ROOT, "_packages", Resources.formatArchiveName("noldova-desktop.protocol", "2.0.0")), layout.locateArchive(BuildLayoutTests.MANIFEST, "2.0.0"));
  }

  @TestMethod
  public async findsTheOneWindowAppOrNoneAsync(): Promise<void> {
    const root = await mkdtemp(path.join(tmpdir(), "build-layout-"));
    try {
      const layout = new BuildLayout(root);
      const withoutSource = layout.windowAppFolder;
      await mkdir(path.join(root, "src", "noldova.desktop.protocol"), { recursive: true });
      await mkdir(path.join(root, "src", "notes.window.app.txt"));
      const withoutApp = layout.windowAppFolder;
      await mkdir(path.join(root, "src", "notes.window.app"));

      Assert.isNull(withoutSource);
      Assert.isNull(withoutApp);
      Assert.areEqual(path.join(root, "src", "notes.window.app"), layout.windowAppFolder);
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async refusesMoreThanOneWindowAppAsync(): Promise<void> {
    const root = await mkdtemp(path.join(tmpdir(), "build-layout-"));
    try {
      await mkdir(path.join(root, "src", "notes.window.app"), { recursive: true });
      await mkdir(path.join(root, "src", "atlas.window.app"));
      const layout = new BuildLayout(root);

      const error = Assert.throws(() => layout.windowAppFolder, BuildException);

      Assert.areEqual(Resources.formatWindowAppsClash(["atlas.window.app", "notes.window.app"]), error.message);
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}
