/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import type { JsonObject } from "@noldova/context.json";

import type { IToolDeadline } from "../interfaces/i-tool-deadline.js";
import type { IToolDescriptor } from "../interfaces/i-tool-descriptor.js";
import type { IToolHints } from "../interfaces/i-tool-hints.js";
import type { IToolLimits } from "../interfaces/i-tool-limits.js";
import type { IToolRiskRange } from "../interfaces/i-tool-risk-range.js";
import { Resources } from "../resources.js";

export class ToolDescriptor {
  public readonly name: string;
  public readonly title: string | null;
  public readonly description: string;
  public readonly inputSchema: JsonObject;
  public readonly outputSchema: JsonObject | null;
  public readonly hints: IToolHints;
  public readonly risk: IToolRiskRange;
  public readonly isResumable: boolean;
  public readonly marksSending: boolean;
  public readonly deadline: IToolDeadline;
  public readonly resource: string | null;
  public readonly limits: IToolLimits;
  public readonly nextTool: string | null;

  public constructor(descriptor: IToolDescriptor, tools: readonly string[]) {
    ArgumentException.throwIfNullOrWhitespace(descriptor.description, Resources.descriptionParameterName);
    if (!Object.isUndefined(descriptor.title) && String.isNullOrWhitespace(descriptor.title))
      throw new ArgumentException(Resources.toolTitleInvalid, Resources.titleParameterName);
    const rank = Resources.toolRisks.indexOf(descriptor.risk.default);
    if (rank < 0 || rank > Resources.toolRisks.indexOf(descriptor.risk.maximum))
      throw new ArgumentException(Resources.toolRiskInvalid, Resources.riskParameterName);
    ToolDescriptor.checkDeadline(descriptor.deadline);
    if (!Object.isUndefined(descriptor.resource) && !Resources.toolResourcePattern.test(descriptor.resource))
      throw new ArgumentException(Resources.toolResourceInvalid, Resources.resourceParameterName);
    ToolDescriptor.checkLimits(descriptor.limits ?? {});
    const canBeUncertain = descriptor.hints?.isReadOnly !== true && descriptor.isResumable !== true;
    if (Object.isUndefined(descriptor.nextTool) ? canBeUncertain : !tools.includes(descriptor.nextTool))
      throw new ArgumentException(Resources.formatToolNextToolInvalid(descriptor.name), Resources.nextToolParameterName);

    this.name = descriptor.name;
    this.title = descriptor.title ?? null;
    this.description = descriptor.description;
    this.inputSchema = descriptor.inputSchema;
    this.outputSchema = descriptor.outputSchema ?? null;
    this.hints = { ...descriptor.hints };
    this.risk = { ...descriptor.risk };
    this.isResumable = descriptor.isResumable ?? false;
    this.marksSending = descriptor.marksSending ?? false;
    this.deadline = { ...descriptor.deadline };
    this.resource = descriptor.resource ?? null;
    this.limits = { ...descriptor.limits };
    this.nextTool = descriptor.nextTool ?? null;
  }

  public get isReadOnly(): boolean {
    return this.hints.isReadOnly === true;
  }

  public get canBeUncertain(): boolean {
    return !this.isReadOnly && !this.isResumable;
  }

  public toJson(): JsonObject {
    const hints = this.hints;
    const limits = this.limits;
    return {
      name: this.name,
      ...Object.isNull(this.title) ? {} : { title: this.title },
      description: this.description,
      inputSchema: this.inputSchema,
      ...Object.isNull(this.outputSchema) ? {} : { outputSchema: this.outputSchema },
      hints: {
        ...Object.isUndefined(hints.isReadOnly) ? {} : { isReadOnly: hints.isReadOnly },
        ...Object.isUndefined(hints.isDestructive) ? {} : { isDestructive: hints.isDestructive },
        ...Object.isUndefined(hints.isOpenWorld) ? {} : { isOpenWorld: hints.isOpenWorld }
      },
      risk: { default: this.risk.default, maximum: this.risk.maximum },
      isResumable: this.isResumable,
      marksSending: this.marksSending,
      deadline: { default: this.deadline.default, maximum: this.deadline.maximum },
      ...Object.isNull(this.resource) ? {} : { resource: this.resource },
      limits: {
        ...Object.isUndefined(limits.textCharacters) ? {} : { textCharacters: limits.textCharacters },
        ...Object.isUndefined(limits.imageBytes) ? {} : { imageBytes: limits.imageBytes },
        ...Object.isUndefined(limits.imageLongEdge) ? {} : { imageLongEdge: limits.imageLongEdge },
        ...Object.isUndefined(limits.imagePixels) ? {} : { imagePixels: limits.imagePixels }
      },
      ...Object.isNull(this.nextTool) ? {} : { nextTool: this.nextTool }
    };
  }

  private static checkDeadline(deadline: IToolDeadline): void {
    const isWhole = Number.isInteger(deadline.default) && Number.isInteger(deadline.maximum);
    if (!isWhole || deadline.default < 1 || deadline.default > deadline.maximum || deadline.maximum > Resources.maximumToolDeadline)
      throw new ArgumentOutOfRangeException(Resources.deadlineParameterName, deadline.maximum, Resources.formatToolDeadlineRange(Resources.maximumToolDeadline));
  }

  private static checkLimits(limits: IToolLimits): void {
    const ceilings: readonly (readonly [string, number | undefined, number])[] = [
      [Resources.textCharactersLimitName, limits.textCharacters, Resources.maximumToolTextBytes],
      [Resources.imageBytesLimitName, limits.imageBytes, Resources.maximumToolImageBytes],
      [Resources.imageLongEdgeLimitName, limits.imageLongEdge, Number.MAX_SAFE_INTEGER],
      [Resources.imagePixelsLimitName, limits.imagePixels, Number.MAX_SAFE_INTEGER]
    ];
    for (const [name, value, ceiling] of ceilings)
      if (!Object.isUndefined(value) && (!Number.isInteger(value) || value < 1 || value > ceiling))
        throw new ArgumentOutOfRangeException(Resources.limitsParameterName, value, Resources.formatToolLimitInvalid(name, ceiling));
  }
}
