/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WebViewBlockedPorts } from "@noldova/desktop.protocol";

@TestClass
export class WebViewBlockedPortsTests {
  @TestMethod
  public pinsItsWireFormWithThePortsInAscendingOrder(): void {
    const text = "{\"serial\":3,\"ports\":[1,52100,65535]}";

    Assert.areEqual(text, JSON.stringify(new WebViewBlockedPorts(3, [65535, 1, 52100]).toJson()));
    Assert.areEqual(text, JSON.stringify(WebViewBlockedPorts.fromJson({ serial: 3, ports: [52100, 65535, 1] }).toJson()));
    Assert.areEqual("{\"serial\":0,\"ports\":[]}", JSON.stringify(WebViewBlockedPorts.fromJson({ serial: 0, ports: [] }).toJson()));
  }

  @TestMethod
  public rejectsASerialOrAPortOutOfRangeAndARepeatedPort(): void {
    const rejected = [
      () => new WebViewBlockedPorts(-1, []),
      () => new WebViewBlockedPorts(1.5, []),
      () => new WebViewBlockedPorts(1, [0]),
      () => new WebViewBlockedPorts(1, [65536]),
      () => new WebViewBlockedPorts(1, [80.5]),
      () => new WebViewBlockedPorts(1, [80, 80])
    ].map(t => Assert.throws(t, ArgumentException).parameterName);

    Assert.areEqual("serial,serial,ports,ports,ports,ports", rejected.join(","));
  }

  @TestMethod
  public rejectsPortsThatAreNotAListOfNumbersAndUnknownFields(): void {
    const paths = [
      { serial: 1, ports: 80 },
      { serial: 1, ports: ["80"] },
      { serial: 1, ports: [80, null] },
      { serial: 1, ports: [80, 80] },
      { ports: [] },
      { serial: 1 },
      { serial: 1, ports: [], kept: true }
    ].map(t => Assert.throws(() => WebViewBlockedPorts.fromJson(t), JsonException).path);

    Assert.areEqual("$.ports,$.ports,$.ports,$.ports,$.serial,$.ports,$.kept", paths.join(","));
  }
}
