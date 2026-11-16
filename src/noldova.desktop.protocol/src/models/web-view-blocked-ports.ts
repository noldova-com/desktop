/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class WebViewBlockedPorts {
  private static readonly FIELDS: readonly string[] = [Resources.serialField, Resources.portsField];
  private static readonly HIGHEST_PORT: number = 65535;

  public readonly serial: number;
  public readonly ports: readonly number[];

  public constructor(serial: number, ports: readonly number[]) {
    if (!Number.isSafeInteger(serial) || serial < 0)
      throw new ArgumentException(Resources.blockedPortsSerialInvalid, Resources.serialField);
    if (ports.some(t => !Number.isInteger(t) || t < 1 || t > WebViewBlockedPorts.HIGHEST_PORT) || new Set(ports).size !== ports.length)
      throw new ArgumentException(Resources.blockedPortsInvalid, Resources.portsField);

    this.serial = serial;
    this.ports = [...ports].sort((a, b) => a - b);
  }

  public static fromJson(value: unknown, path?: string): WebViewBlockedPorts {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, WebViewBlockedPorts.FIELDS);
    const serial = reader.readInteger(Resources.serialField);
    const ports = reader.readValue(Resources.portsField);
    return WireContract.create(reader, () => new WebViewBlockedPorts(serial, WebViewBlockedPorts.readPorts(ports)));
  }

  public toJson(): JsonObject {
    return { [Resources.serialField]: this.serial, [Resources.portsField]: [...this.ports] };
  }

  private static readPorts(value: JsonValue): number[] {
    if (!Array.isArray(value) || value.some(t => !Object.isNumber(t)))
      throw new ArgumentException(Resources.blockedPortsInvalid, Resources.portsField);
    return value.filter(Object.isNumber);
  }
}
