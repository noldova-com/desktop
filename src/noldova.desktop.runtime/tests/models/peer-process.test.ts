/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { PeerProcess } from "../../src/models/peer-process.js";

@TestClass
export class PeerProcessTests {
  @TestMethod
  public keepsTheProgramTheEnvironmentAndTheSender(): void {
    const peer = new PeerProcess("/usr/bin/fixture-studio", ["HOME=/home/person"], "org.fixtureworks.studio");

    Assert.areEqual("/usr/bin/fixture-studio", peer.program);
    Assert.areEqual("HOME=/home/person", peer.environment.join("|"));
    Assert.areEqual("org.fixtureworks.studio", peer.sender);
  }

  @TestMethod
  public hasNoSenderByDefault(): void {
    Assert.isNull(new PeerProcess("/usr/bin/fixture-studio", []).sender);
  }
}
