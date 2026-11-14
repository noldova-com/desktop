/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GrantedFile } from "../models/granted-file.js";
import type { RequestContext } from "../models/request-context.js";
import type { IFileShareOptions } from "./i-file-share-options.js";

export interface IRuntimeFiles {
  redeemAsync(grant: string, request: RequestContext): Promise<GrantedFile>;
  shareAsync(file: string, request: RequestContext, options?: IFileShareOptions): Promise<string>;
}
