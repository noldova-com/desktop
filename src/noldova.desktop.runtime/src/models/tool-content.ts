/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonObject } from "@noldova/context.json";

import { ToolContentKind } from "../enums/tool-content-kind.js";
import { Resources } from "../resources.js";

export class ToolContent {
  public readonly kind: ToolContentKind;
  public readonly value: string;
  public readonly mimeType: string | null;
  public readonly origin: string | null;

  private constructor(kind: ToolContentKind, value: string, mimeType: string | null, origin: string | null) {
    if (!Object.isNull(origin) && (String.isNullOrWhitespace(origin) || origin.length > Resources.maximumToolOriginLength))
      throw new ArgumentException(Resources.toolOriginInvalid, Resources.originParameterName);

    this.kind = kind;
    this.value = value;
    this.mimeType = mimeType;
    this.origin = origin;
  }

  public get isUntrusted(): boolean {
    return !Object.isNull(this.origin);
  }

  public static fromText(text: string, origin: string | null): ToolContent {
    if (!Object.isString(text))
      throw new ArgumentException(Resources.toolTextInvalid, Resources.textParameterName);
    return new ToolContent(ToolContentKind.Text, text, null, origin);
  }

  public static fromImage(data: string, mimeType: string, origin: string | null): ToolContent {
    if (!Resources.toolImageTypes.includes(mimeType))
      throw new ArgumentException(Resources.formatToolImageType(mimeType), Resources.mimeTypeParameterName);
    if (!Resources.base64Pattern.test(data))
      throw new ArgumentException(Resources.toolImageDataInvalid, Resources.dataParameterName);
    return new ToolContent(ToolContentKind.Image, data, mimeType, origin);
  }

  public toJson(): JsonObject {
    const value = this.kind === ToolContentKind.Text ? { text: this.value } : { data: this.value, mimeType: this.mimeType };
    const marks = Object.isNull(this.origin) ? { isUntrusted: false } : { isUntrusted: true, origin: this.origin };
    return { kind: this.kind, ...value, ...marks };
  }
}
