/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { GitHubRelease } from "../../../src/models/release/github-release.js";

@TestClass
export class GitHubReleaseTests {
  @TestMethod
  public readsTheReleaseAndEachAsset(): void {
    const release = GitHubRelease.read({
      id: 7,
      tag_name: "v1.2.3",
      target_commitish: "main",
      draft: true,
      assets: [{ id: 1, name: "App.AppImage", size: 10, state: "uploaded", digest: "sha256:ab" }, { id: 2, name: "App.exe", size: 0, state: "starter", digest: null }]
    }, "The release");

    Assert.areEqual("7,v1.2.3,main,true", [release.id, release.tag, release.target, release.isDraft].join());
    Assert.areEqual("1|App.AppImage|10|true|sha256:ab,2|App.exe|0|false|null",
      release.assets.map(t => [t.id, t.name, t.size, t.isUploaded, String(t.digest)].join("|")).join());
  }

  @TestMethod
  public refusesAReleaseOrAssetOfTheWrongShape(): void {
    const valid = { id: 7, tag_name: "v1.2.3", target_commitish: "main", draft: false, assets: [] };
    const asset = { id: 1, name: "App.AppImage", size: 10, state: "uploaded", digest: null };
    const cases: readonly (readonly [unknown, string])[] = [
      [[], "The release must be an object."],
      [{ ...valid, id: 1.5 }, "The release.id must be a whole number."],
      [{ ...valid, id: "7" }, "The release.id must be a whole number."],
      [{ ...valid, tag_name: 1 }, "The release.tag_name must be text."],
      [{ ...valid, draft: "false" }, "The release.draft must be true or false."],
      [{ ...valid, assets: {} }, "The release.assets must be an array."],
      [{ ...valid, assets: [null] }, "The release.assets[0] must be an object."],
      [{ ...valid, assets: [asset, { ...asset, digest: 1 }] }, "The release.assets[1].digest must be text."]
    ];

    for (const [value, message] of cases)
      Assert.areEqual(message, Assert.throws(() => GitHubRelease.read(value, "The release"), BuildException).message);
  }
}
