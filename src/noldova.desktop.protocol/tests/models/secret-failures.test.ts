/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { Failure, FailureCode, SecretFailureReason, SecretFailures } from "@noldova/desktop.protocol";

@TestClass
export class SecretFailuresTests {
  @TestMethod
  @TestData(SecretFailureReason.NotConnected)
  @TestData(SecretFailureReason.NoDevice)
  @TestData(SecretFailureReason.Unprotected)
  @TestData(SecretFailureReason.Undecryptable)
  public readsBackEachReasonAfterTheWire(reason: SecretFailureReason): void {
    const failure = Failure.fromJson(new Failure(FailureCode.Unavailable, "Open the app.", SecretFailures.detailsOf(reason)).toJson());

    Assert.areEqual(`{"reason":"${reason}"}`, JSON.stringify(failure.details));
    Assert.areEqual(reason, SecretFailures.reasonOf(failure));
  }

  @TestMethod
  @TestData(FailureCode.Unavailable, undefined)
  @TestData(FailureCode.Unavailable, { reason: "Asleep" })
  @TestData(FailureCode.Unavailable, { reason: 3 })
  @TestData(FailureCode.Unavailable, { other: "Unprotected" })
  @TestData(FailureCode.NotFound, { reason: "Unprotected" })
  public readsNoReasonFromAnyOtherFailure(code: FailureCode, details: JsonObject | undefined): void {
    Assert.isNull(SecretFailures.reasonOf(new Failure(code, "Not a secret's failure.", details)));
  }
}
