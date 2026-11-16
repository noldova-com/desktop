/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type * as build from "@noldova/desktop.build";
import type * as cli from "@noldova/desktop.cli";
import type * as electron from "@noldova/desktop.electron";
import type * as runtime from "@noldova/desktop.runtime";
import type * as runtimeTesting from "@noldova/desktop.runtime/testing";

export type Packages = [typeof build, typeof cli, typeof electron, typeof runtime, typeof runtimeTesting];
