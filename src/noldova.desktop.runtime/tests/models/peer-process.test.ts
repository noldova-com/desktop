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
  public hasNoSenderProcessIdOrStartTimeByDefault(): void {
    const peer = new PeerProcess("/usr/bin/fixture-studio", []);

    Assert.isNull(peer.sender);
    Assert.isNull(peer.processId);
    Assert.isNull(peer.startTime);
  }

  @TestMethod
  public keepsTheProcessIdAndTheStartTime(): void {
    const peer = new PeerProcess("/proc/4120/exe", [], null, 4120, "88123");

    Assert.areEqual(4120, peer.processId);
    Assert.areEqual("88123", peer.startTime);
  }
}
