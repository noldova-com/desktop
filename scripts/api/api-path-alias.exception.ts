/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ApiException } from "./api.exception.ts";

export class ApiPathAliasException extends ApiException {
  public readonly projectName: string;
  public readonly part: string;
  public readonly entryName: string;
  public readonly title: string;

  public constructor(projectName: string, part: string, entryName: string, title: string) {
    super(Resources.formatApiCatalogNoPathAlias(projectName, part, entryName, title));

    this.projectName = projectName;
    this.part = part;
    this.entryName = entryName;
    this.title = title;
  }
}
