/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DiscoveryFieldInvalidException, DiscoveryNotObjectException, DiscoveryVersionUnsupportedException, RuntimeDiscovery } from "@noldova/desktop.runtime";

@TestClass
export class RuntimeDiscoveryTests {
  @TestMethod
  public writesEveryFieldWithTheFormatVersion(): void {
    const discovery = new RuntimeDiscovery("/tmp/noldova-desktop.sock", "token", 12, "/usr/bin/node", "0.0.1", 3, "build");

    Assert.areEqual(
      "{\"formatVersion\":1,\"endpoint\":\"/tmp/noldova-desktop.sock\",\"token\":\"token\",\"processId\":12,\"executablePath\":\"/usr/bin/node\",\"productVersion\":\"0.0.1\",\"protocolVersion\":3,\"build\":\"build\"}",
      JSON.stringify(discovery.toJson()));
    Assert.areEqual("/tmp/noldova-desktop.sock", discovery.endpoint);
    Assert.areEqual("token", discovery.token);
    Assert.areEqual(12, discovery.processId);
    Assert.areEqual("/usr/bin/node", discovery.executablePath);
    Assert.areEqual("0.0.1", discovery.productVersion);
    Assert.areEqual(3, discovery.protocolVersion);
    Assert.areEqual("build", discovery.build);
  }

  @TestMethod
  public refusesEmptyTextAndNonPositiveNumbers(): void {
    Assert.throws(() => new RuntimeDiscovery(" ", "token", 1, "node", "0.0.1", 1, "build"), ArgumentException);
    Assert.throws(() => new RuntimeDiscovery("endpoint", String.empty, 1, "node", "0.0.1", 1, "build"), ArgumentException);
    Assert.throws(() => new RuntimeDiscovery("endpoint", "token", 0, "node", "0.0.1", 1, "build"), ArgumentOutOfRangeException);
    Assert.throws(() => new RuntimeDiscovery("endpoint", "token", 1, String.empty, "0.0.1", 1, "build"), ArgumentException);
    Assert.throws(() => new RuntimeDiscovery("endpoint", "token", 1, "node", String.empty, 1, "build"), ArgumentException);
    Assert.throws(() => new RuntimeDiscovery("endpoint", "token", 1, "node", "0.0.1", 1.5, "build"), ArgumentOutOfRangeException);
    Assert.throws(() => new RuntimeDiscovery("endpoint", "token", 1, "node", "0.0.1", 1, String.empty), ArgumentException);
  }

  @TestMethod
  public readsItsOwnJsonBack(): void {
    const discovery = new RuntimeDiscovery("/tmp/noldova-desktop.sock", "token", 12, "/usr/bin/node", "0.0.1", 3, "build");

    Assert.areEqual(JSON.stringify(discovery.toJson()), JSON.stringify(RuntimeDiscovery.fromJson(JsonReader.parse(JSON.stringify(discovery.toJson())).toJson()).toJson()));
  }

  @TestMethod
  public refusesAnythingButAnObjectOfTheKnownFormatVersion(): void {
    for (const value of [null, [], "text", 1])
      Assert.areEqual("The discovery metadata is not a JSON object.", Assert.throws(() => RuntimeDiscovery.fromJson(value), DiscoveryNotObjectException).message);
    const versions: readonly (readonly [object, string])[] = [[{}, "undefined"], [{ formatVersion: 2 }, "2"], [{ formatVersion: "1" }, "1"]];
    for (const [value, version] of versions)
      Assert.areEqual(
        `The discovery metadata has the unsupported format version ${version}.`,
        Assert.throws(() => RuntimeDiscovery.fromJson(value), DiscoveryVersionUnsupportedException).message);
  }

  @TestMethod
  public namesTheFirstMissingOrInvalidField(): void {
    const valid = { formatVersion: 1, endpoint: "e", token: "t", processId: 1, executablePath: "n", productVersion: "0.0.1", protocolVersion: 1, build: "b" };
    const cases: readonly (readonly [object, string])[] = [
      [{ ...valid, endpoint: undefined }, "endpoint"],
      [{ ...valid, endpoint: 1 }, "endpoint"],
      [{ ...valid, token: undefined }, "token"],
      [{ ...valid, token: " " }, "token"],
      [{ ...valid, processId: undefined }, "processId"],
      [{ ...valid, processId: "1" }, "processId"],
      [{ ...valid, processId: 1.5 }, "processId"],
      [{ ...valid, processId: 0 }, "processId"],
      [{ ...valid, executablePath: undefined }, "executablePath"],
      [{ ...valid, productVersion: undefined }, "productVersion"],
      [{ ...valid, protocolVersion: undefined }, "protocolVersion"],
      [{ ...valid, build: undefined }, "build"]
    ];
    for (const [value, field] of cases)
      Assert.areEqual(
        `The discovery metadata's ${field} is missing or invalid.`,
        Assert.throws(() => RuntimeDiscovery.fromJson(JsonReader.parse(JSON.stringify(value)).toJson()), DiscoveryFieldInvalidException).message);
  }

  @TestMethod
  public passesOnAFailureToReadTheValueThatIsNotAboutItsFormat(): void {
    const failure = new RangeError("The value cannot be read.");
    const value = { get formatVersion(): number { throw failure; } };

    Assert.areEqual(failure, Assert.throws(() => RuntimeDiscovery.fromJson(value), RangeError));
  }
}
