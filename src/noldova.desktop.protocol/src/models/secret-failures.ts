/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { JsonObject } from "@noldova/context.json";

import { FailureCode } from "../enums/failure-code.js";
import { SecretFailureReason } from "../enums/secret-failure-reason.js";
import { Resources } from "../resources.js";
import type { Failure } from "./failure.js";

export class SecretFailures {
  private static readonly REASONS: readonly string[] = Object.values(SecretFailureReason);

  public static detailsOf(reason: SecretFailureReason): JsonObject {
    return { [Resources.reasonField]: reason };
  }

  public static reasonOf(failure: Failure): SecretFailureReason | null {
    const reason = failure.code === FailureCode.Unavailable ? failure.details?.[Resources.reasonField] : undefined;
    return SecretFailures.isReason(reason) ? reason : null;
  }

  private static isReason(value: unknown): value is SecretFailureReason {
    return Object.isString(value) && SecretFailures.REASONS.includes(value);
  }
}
