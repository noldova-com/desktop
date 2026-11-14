/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.ts";

export class GitAttributesValidator {
  public validate(text: string | null): readonly string[] {
    if (Object.isNull(text))
      return [Resources.gitAttributesMissing];
    return text.split(Resources.lineEnd).some(t => t.trim() === Resources.gitAttributesLineEndingRule)
      ? []
      : [Resources.gitAttributesLacking];
  }
}
