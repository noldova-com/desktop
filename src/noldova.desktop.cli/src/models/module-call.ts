/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";

import { CliOptionType } from "../enums/cli-option-type.js";
import { ArgumentRequiredException } from "../exceptions/argument-required.exception.js";
import { OptionNeedsValueException } from "../exceptions/option-needs-value.exception.js";
import { OptionNotNumberException } from "../exceptions/option-not-number.exception.js";
import { OptionRepeatedException } from "../exceptions/option-repeated.exception.js";
import { OptionRequiredException } from "../exceptions/option-required.exception.js";
import { OptionTakesNoValueException } from "../exceptions/option-takes-no-value.exception.js";
import { UnexpectedArgumentException } from "../exceptions/unexpected-argument.exception.js";
import { UnknownOptionException } from "../exceptions/unknown-option.exception.js";
import { Resources } from "../resources.js";
import type { CliCommandDefinition } from "./cli-command-definition.js";
import type { CliOptionDefinition } from "./cli-option-definition.js";

export class ModuleCall {
  public readonly command: CliCommandDefinition;
  public readonly values: Readonly<Record<string, JsonValue>>;

  private constructor(command: CliCommandDefinition, values: Readonly<Record<string, JsonValue>>) {
    this.command = command;
    this.values = values;
  }

  public static parse(command: CliCommandDefinition, tokens: readonly string[]): ModuleCall {
    const positional: string[] = [];
    const given = new Map<CliOptionDefinition, JsonValue>();
    const queue = [...tokens];
    let isOptionsEnd = false;
    for (let token = queue.shift(); !Object.isUndefined(token); token = queue.shift()) {
      if (!isOptionsEnd && token === Resources.flagPrefix)
        isOptionsEnd = true;
      else if (isOptionsEnd || !token.startsWith(Resources.flagPrefix))
        positional.push(token);
      else {
        const [option, value] = ModuleCall.readOption(command, token, queue);
        const previous = given.get(option);
        if (!Object.isUndefined(previous) && !option.isRepeated)
          throw new OptionRepeatedException(option.flag);
        given.set(option, option.isRepeated ? [...(Array.isArray(previous) ? previous : []), value] : value);
      }
    }
    return new ModuleCall(command, { ...ModuleCall.readArguments(command, positional), ...ModuleCall.readOptions(command, given) });
  }

  private static readOption(command: CliCommandDefinition, token: string, queue: string[]): readonly [CliOptionDefinition, JsonValue] {
    const separator = token.indexOf(Resources.valueSeparator);
    const flag = separator < 0 ? token : token.slice(0, separator);
    const option = command.options.find(t => t.flag === flag);
    if (Object.isUndefined(option))
      throw new UnknownOptionException(token);
    if (option.type === CliOptionType.Boolean) {
      if (separator >= 0)
        throw new OptionTakesNoValueException(flag);
      return [option, true];
    }
    const next = queue[0];
    const text = separator >= 0 ? token.slice(separator + 1) : Object.isUndefined(next) || next.startsWith(Resources.flagPrefix) ? undefined : queue.shift();
    if (Object.isUndefined(text))
      throw new OptionNeedsValueException(flag);
    if (option.type === CliOptionType.Text)
      return [option, text];
    if (!Resources.numberPattern.test(text))
      throw new OptionNotNumberException(flag, text);
    return [option, Number(text)];
  }

  private static readArguments(command: CliCommandDefinition, positional: readonly string[]): Record<string, JsonValue> {
    const values: Record<string, JsonValue> = {};
    const extra = command.arguments.at(-1)?.isVariadic === true ? undefined : positional[command.arguments.length];
    if (!Object.isUndefined(extra))
      throw new UnexpectedArgumentException(extra);
    command.arguments.forEach((argument, index) => {
      const value = argument.isVariadic ? positional.slice(index) : positional[index];
      if (!Object.isUndefined(value) && !(Array.isArray(value) && value.length === 0))
        values[argument.name] = value;
      else if (argument.isRequired)
        throw new ArgumentRequiredException(argument.placeholder);
    });
    return values;
  }

  private static readOptions(command: CliCommandDefinition, given: ReadonlyMap<CliOptionDefinition, JsonValue>): Record<string, JsonValue> {
    const values: Record<string, JsonValue> = {};
    for (const option of command.options) {
      const value = given.get(option);
      if (!Object.isUndefined(value))
        values[option.name] = value;
      else if (option.isRequired)
        throw new OptionRequiredException(option.flag);
      else if (!Object.isNull(option.defaultValue))
        values[option.name] = option.defaultValue;
    }
    return values;
  }
}
