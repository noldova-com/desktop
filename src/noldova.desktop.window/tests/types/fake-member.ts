/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Fake } from "@noldova/desktop.protocol/testing";

export type FakeMember<T extends object> =
  | readonly ["answered" | "told" | "property" | "fake", (fake: Fake<T> & T) => unknown]
  | readonly ["tracked" | "listened", (fake: Fake<T> & T) => () => void];
