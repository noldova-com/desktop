/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WebViewFailure } from "@noldova/desktop.protocol";

import { Resources } from "../resources.js";
import { RuntimeException } from "./runtime.exception.js";

export class WebViewFailureException extends RuntimeException {
  public readonly failure: WebViewFailure;

  public constructor(failure: WebViewFailure) {
    super(failure.message ?? Resources.formatWebViewFailed(failure.kind));

    this.failure = failure;
  }
}
