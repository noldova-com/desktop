/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { Failure, FailureCode, FileGrantsEnded, ShellClients } from "@noldova/desktop.protocol";

import { MethodFailureException } from "../../exceptions/method-failure.exception.js";
import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { RequestContext } from "../../models/request-context.js";
import { Resources } from "../../resources.js";
import type { FileGrantTable } from "./file-grant-table.js";

export class EndFileGrantsMethod implements IMethodHandler {
  private readonly table: FileGrantTable;

  public constructor(table: FileGrantTable) {
    this.table = table;
  }

  public handleAsync(context: RequestContext): Promise<JsonValue> {
    if (context.client !== ShellClients.mainProcess || !Object.isNull(context.window))
      return Promise.reject(new MethodFailureException(new Failure(FailureCode.Unauthorized, Resources.fileGrantsNotFromApp)));
    const ended = FileGrantsEnded.fromJson(context.payload);
    this.table.endPage(context.connection, ended.window, ended.page);
    return Promise.resolve(null);
  }
}
