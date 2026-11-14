/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { TypeOnlyPeers } from "../../../src/models/packaging/type-only-peers.js";

@TestClass
export class TypeOnlyPeersTests {
  @TestMethod
  public async readsThePeersEachPackageNeverLoads(): Promise<void> {
    const peers = await TypeOnlyPeersTests.readAsync({
      "sample@1.0.0": { peers: ["types-a", "types-b"], reason: "Types only." },
      "sample@2.0.0": { peers: ["types-a"], reason: "Types only." }
    });

    Assert.isTrue(peers.passes("sample@1.0.0", "types-b"));
    Assert.isFalse(peers.passes("sample@2.0.0", "types-b"));
    Assert.isFalse(peers.passes("other@1.0.0", "types-a"));
    Assert.areEqual("types-a,types-b", peers.of("sample@1.0.0").join(","));
    Assert.areEqual(0, peers.of("other@1.0.0").length);
    Assert.areEqual("sample@1.0.0's types-a, types-b; sample@2.0.0's types-a", peers.describe());
    Assert.areEqual("sample@1.0.0,sample@2.0.0", peers.ids.join(","));
    Assert.areEqual("sample@2.0.0", peers.listOtherVersions("sample@1.0.0").join(","));
  }

  @TestMethod
  public async refusesAnEntryWithoutPeers(): Promise<void> {
    const error = await Assert.throwsAsync(() => TypeOnlyPeersTests.readAsync({ "sample@1.0.0": { peers: [], reason: "Types only." } }), BuildException);

    Assert.isTrue(error.message.includes("desktop.packaging.typeOnlyPeers"), error.message);
  }

  private static async readAsync(peers: object): Promise<TypeOnlyPeers> {
    const root = await mkdtemp(path.join(tmpdir(), "type-only-peers-"));
    try {
      await writeFile(path.join(root, "package.json"), JSON.stringify({ desktop: { packaging: { typeOnlyPeers: peers } } }));
      return await TypeOnlyPeers.readAsync(root);
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}
