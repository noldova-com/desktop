/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { lstat, open, readdir } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class PackagedArchitecture {
  public static async verifyAsync(folder: string, architecture: string, platform: string): Promise<string> {
    if (Object.isUndefined(Resources.machCpuTypes[architecture]))
      throw new BuildException(Resources.formatNativeArchitectureUnknown(architecture, Object.keys(Resources.machCpuTypes)));
    const runnable = platform === Resources.windowsTarget
      ? Resources.windowsRunnablePeMachines.filter(([target]) => target === architecture).map(([, machine]) => machine)
      : [architecture];
    const held: string[] = [];
    for (const file of await PackagedArchitecture.listFilesAsync(folder)) {
      const native = await PackagedArchitecture.describeAsync(file);
      if (Object.isNull(native))
        continue;
      const [kind, found] = native;
      const accepted = kind === Resources.peKind ? runnable : [architecture];
      if (!accepted.includes(found))
        throw new BuildException(accepted.length === 1 ? Resources.formatNativeArchitectureMismatch(file, found, kind, architecture)
          : Resources.formatWindowsMachineMismatch(file, found, architecture, accepted));
      held.push(found);
    }
    return runnable.length === 1 ? Resources.formatNativeArchitectureVerified(folder, held.length, architecture)
      : Resources.formatWindowsMachinesVerified(folder, architecture, runnable, runnable.map(t => [t, held.filter(h => h === t).length] as const));
  }

  private static async listFilesAsync(folder: string): Promise<readonly string[]> {
    const files: string[] = [];
    for (const name of await readdir(folder)) {
      const entry = path.join(folder, name);
      const status = await lstat(entry);
      if (status.isDirectory())
        files.push(...await PackagedArchitecture.listFilesAsync(entry));
      else if (status.isFile())
        files.push(entry);
    }
    return files;
  }

  private static async describeAsync(file: string): Promise<readonly [string, string] | null> {
    const handle = await open(file, Resources.fileReadFlag);
    try {
      const header = Buffer.alloc(Resources.nativeHeaderLength);
      await handle.read(header, 0, header.length, 0);
      if (header.subarray(0, Resources.nativeDosMagic.length).equals(Resources.nativeDosMagic)) {
        const signature = Buffer.alloc(Resources.peSignatureLength);
        await handle.read(signature, 0, signature.length, header.readUInt32LE(Resources.peHeaderOffsetField));
        return signature.subarray(0, Resources.nativePeMagic.length).equals(Resources.nativePeMagic) ? PackagedArchitecture.describePe(signature.readUInt16LE(Resources.peMachineOffset)) : null;
      }
      return header.subarray(0, Resources.elfMagic.length).toString(Resources.elfMagicEncoding) === Resources.elfMagic ? PackagedArchitecture.describeElf(header) : PackagedArchitecture.describeMach(header);
    }
    finally {
      await handle.close();
    }
  }

  private static describePe(machine: number): readonly [string, string] {
    return [Resources.peKind, PackagedArchitecture.nameOf(Resources.peMachines, machine) ?? Resources.formatPeMachine(machine)];
  }

  private static describeElf(header: Buffer): readonly [string, string] {
    if (header[Resources.elfClassOffset] !== Resources.elf64BitClass)
      return [Resources.elfKind, Resources.elf32BitFile];
    if (header[Resources.elfDataOffset] !== Resources.elfLittleEndianData)
      return [Resources.elfKind, Resources.elfBigEndianFile];
    const machine = header.readUInt16LE(Resources.elfMachineOffset);
    return [Resources.elfKind, PackagedArchitecture.nameOf(Resources.elfMachines, machine) ?? Resources.formatElfMachine(machine)];
  }

  private static describeMach(header: Buffer): readonly [string, string] | null {
    if (Resources.machUniversalMagics.includes(header.readUInt32BE(0)) && header.readUInt32BE(Resources.machUniversalCountOffset) <= Resources.machUniversalArchitectureLimit)
      return [Resources.machKind, Resources.machUniversalFile];
    if (header.readUInt32LE(0) === Resources.machThin32Magic)
      return [Resources.machKind, Resources.mach32BitFile];
    if (header.readUInt32LE(0) !== Resources.machThinMagic)
      return null;
    const type = header.readUInt32LE(Resources.machCpuTypeOffset);
    return [Resources.machKind, PackagedArchitecture.nameOf(Resources.machCpuTypes, type) ?? Resources.formatMachCpuType(type)];
  }

  private static nameOf(table: Readonly<Record<string, number>>, value: number): string | undefined {
    return Object.entries(table).find(([, t]) => t === value)?.[0];
  }
}
