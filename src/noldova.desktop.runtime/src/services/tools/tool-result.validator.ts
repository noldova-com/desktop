/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";

import { ToolContentKind } from "../../enums/tool-content-kind.js";
import { ToolFailureCode } from "../../enums/tool-failure-code.js";
import type { IToolSchemaValidator } from "../../interfaces/i-tool-schema.validator.js";
import type { RegisteredTool } from "../../models/registered-tool.js";
import type { ToolContent } from "../../models/tool-content.js";
import { ToolFailure } from "../../models/tool-failure.js";
import type { ToolResult } from "../../models/tool-result.js";
import { Resources } from "../../resources.js";
import { ImageSizeReader } from "./image-size.reader.js";

export class ToolResultValidator {
  private readonly images: ImageSizeReader = new ImageSizeReader();
  private readonly schemas: IToolSchemaValidator;

  public constructor(schemas: IToolSchemaValidator) {
    this.schemas = schemas;
  }

  public checkResult(tool: RegisteredTool, result: ToolResult, isPastPointOfNoReturn: boolean): ToolResult | ToolFailure {
    const problem = this.findContentProblem(tool, result.content)
      ?? this.findStructuredProblem(tool, result)
      ?? (ToolResultValidator.isWithinSize(result.toJson()) ? null : ToolResultValidator.tooLarge());
    return Object.isNull(problem) ? result : this.checkFailure(tool, problem, isPastPointOfNoReturn);
  }

  public isWellFormed(tool: RegisteredTool, failure: ToolFailure): boolean {
    return Object.isNull(this.findFailureProblem(tool, failure));
  }

  public checkFailure(tool: RegisteredTool, failure: ToolFailure, isPastPointOfNoReturn: boolean): ToolFailure {
    const checked = this.findFailureProblem(tool, failure) ?? failure;
    if (!isPastPointOfNoReturn && checked.code !== ToolFailureCode.OutcomeUncertain)
      return checked;
    return new ToolFailure(ToolFailureCode.OutcomeUncertain, checked.message, checked.moduleCode, checked.content, checked.nextTool ?? tool.descriptor.nextTool);
  }

  private findFailureProblem(tool: RegisteredTool, failure: ToolFailure): ToolFailure | null {
    const id = tool.moduleId;
    const code = failure.moduleCode;
    const isModuleCode = Object.isNull(code) || (code.startsWith(Resources.formatModuleCode(id, String.empty)) && Resources.moduleCodeNamePattern.test(code.slice(id.length + 1)));
    const isNextTool = Object.isNull(failure.nextTool) || tool.moduleTools.includes(failure.nextTool);
    const isAllowed = failure.code !== ToolFailureCode.OutcomeUncertain || tool.descriptor.canBeUncertain;
    if (!isModuleCode || !isNextTool || !isAllowed)
      return ToolResultValidator.malformed(tool);
    return this.findContentProblem(tool, failure.content) ?? (ToolResultValidator.isWithinSize(failure.toJson()) ? null : ToolResultValidator.tooLarge());
  }

  private findContentProblem(tool: RegisteredTool, items: readonly ToolContent[]): ToolFailure | null {
    for (const item of items) {
      if (!Object.isNull(item.origin) && !ToolResultValidator.isOrigin(tool.moduleId, item.origin))
        return ToolResultValidator.malformed(tool);
      const problem = item.kind === ToolContentKind.Text ? ToolResultValidator.findTextProblem(tool, item.value) : this.findImageProblem(tool, item);
      if (!Object.isNull(problem))
        return problem;
    }
    return null;
  }

  private findImageProblem(tool: RegisteredTool, item: ToolContent): ToolFailure | null {
    const bytes = Buffer.from(item.value, Resources.base64Encoding);
    const size = this.images.read(bytes, item.mimeType);
    if (Object.isNull(size))
      return ToolResultValidator.malformed(tool);
    const limits = tool.descriptor.limits;
    const isTooLarge = bytes.length > Math.min(Resources.maximumToolImageBytes, limits.imageBytes ?? Number.POSITIVE_INFINITY)
      || size.longEdge > (limits.imageLongEdge ?? Number.POSITIVE_INFINITY)
      || size.pixels > (limits.imagePixels ?? Number.POSITIVE_INFINITY);
    return isTooLarge ? ToolResultValidator.tooLarge() : null;
  }

  private static findTextProblem(tool: RegisteredTool, text: string): ToolFailure | null {
    const isTooLarge = Buffer.byteLength(text, Resources.utf8Encoding) > Resources.maximumToolTextBytes
      || [...text].length > (tool.descriptor.limits.textCharacters ?? Number.POSITIVE_INFINITY);
    return isTooLarge ? ToolResultValidator.tooLarge() : null;
  }

  private findStructuredProblem(tool: RegisteredTool, result: ToolResult): ToolFailure | null {
    const schema = tool.descriptor.outputSchema;
    const structured = result.structured;
    if (Object.isNull(schema) || Object.isNull(structured))
      return Object.isNull(schema) === Object.isNull(structured) ? null : ToolResultValidator.malformed(tool);
    return Object.isNull(this.schemas.findProblem(schema, structured)) ? null : ToolResultValidator.malformed(tool);
  }

  private static isOrigin(moduleId: string, origin: string): boolean {
    if (origin.startsWith(Resources.formatModuleOrigin(moduleId)))
      return origin.length > moduleId.length + 1;
    return URL.canParse(origin) && new URL(origin).origin === origin;
  }

  private static isWithinSize(value: JsonObject): boolean {
    return Buffer.byteLength(JSON.stringify(value), Resources.utf8Encoding) <= Resources.maximumToolResultBytes;
  }

  private static malformed(tool: RegisteredTool): ToolFailure {
    return new ToolFailure(ToolFailureCode.Unavailable, Resources.toolMalformedResult, Resources.formatModuleCode(tool.moduleId, Resources.malformedResultCode));
  }

  private static tooLarge(): ToolFailure {
    return new ToolFailure(ToolFailureCode.TooLarge, Resources.toolResultTooLarge);
  }
}
