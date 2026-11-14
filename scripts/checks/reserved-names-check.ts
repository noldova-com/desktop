/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import path from "node:path";
import type { Writable } from "node:stream";

import { Resources as BuildResources } from "../../src/noldova.desktop.build/src/resources.ts";
import { Resources } from "../resources.ts";
import { ClassFieldsReader } from "../structure/class-fields.reader.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class ReservedNamesCheck implements ICheck {
  public readonly title: string = Resources.reservedNamesTitle;

  public async runAsync(output: Writable): Promise<boolean> {
    const cli = await ClassFieldsReader.readAsync(ReservedNamesCheck.locate(Resources.reservedNamesCliFile));
    const runtime = await ClassFieldsReader.readAsync(ReservedNamesCheck.locate(Resources.reservedNamesRuntimeFile));
    const lists = [
      [Resources.reservedNamesCliFile, Resources.reservedNamesCommandsField, cli.readList(Resources.reservedNamesCommandsField)],
      [Resources.reservedNamesCliFile, Resources.reservedNamesValueOptionsField, cli.readList(Resources.reservedNamesValueOptionsField)],
      [Resources.reservedNamesCliFile, Resources.reservedNamesSwitchesField, cli.readList(Resources.reservedNamesSwitchesField)],
      [Resources.reservedNamesRuntimeFile, Resources.reservedNamesDeviceNamesField, runtime.readList(Resources.reservedNamesDeviceNamesField)]
    ] as const;
    const unreadable = lists.filter(([, , list]) => Object.isNull(list))
      .map(([file, name]) => Resources.formatReservedNamesUnreadable(file, name));
    const [commands, valueOptions, switches, deviceNames] = lists.map(([, , list]) => list);
    const pairs = [
      [Resources.reservedNamesReservedCommandsField, BuildResources.reservedCommands, Resources.reservedNamesCommandsOwner, commands ?? []],
      [Resources.reservedNamesReservedOptionsField, BuildResources.reservedOptions, Resources.reservedNamesOptionsOwner, [...valueOptions ?? [], ...switches ?? []]],
      [Resources.reservedNamesDeviceNamesField, BuildResources.windowsDeviceNames, Resources.reservedNamesDeviceNamesOwner, deviceNames ?? []]
    ] as const;
    const findings = [...unreadable, ...pairs.filter(([, copy, , owned]) => copy.join(Resources.reservedNamesComparedSeparator) !== owned.join(Resources.reservedNamesComparedSeparator))
      .map(([name, copy, owner, owned]) => Resources.formatReservedNamesMismatch(name, copy, owner, owned))];
    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.formatReservedNamesChecked(pairs.length));
    return findings.length === 0;
  }

  private static locate(file: string): string {
    return path.join(import.meta.dirname, ...Resources.reservedNamesRootFromChecks, file);
  }
}
