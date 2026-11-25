/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import childProcess from "node:child_process";

import { ExceptionOptions } from "@noldova/context.exceptions";

import { SocketStateException } from "./socket-state.exception.ts";

export class WindowsSocketReader {
  private static readonly PLATFORM: string = "win32";
  private static readonly TIMEOUT: number = 10_000;
  private static readonly ENCODING: BufferEncoding = "utf8";
  private static readonly OTHER_PLATFORM: string = "Socket state is read on Windows only.";
  private static readonly MEMORY_SCRIPT: string = "'pool ' + (Get-CimInstance Win32_PerfRawData_PerfOS_Memory).PoolNonpagedBytes; "
    + "Get-Process -Name chrome*, node -ErrorAction SilentlyContinue | ForEach-Object { 'process ' + $_.ProcessName + ' ' + $_.Id + ' ' + $_.HandleCount + ' ' + $_.WorkingSet64 }";

  public readConnections(): string {
    return WindowsSocketReader.run("netstat", ["-ano", "-p", "tcp"]);
  }

  public readPortRange(): string {
    return WindowsSocketReader.run("netsh", ["int", "ipv4", "show", "dynamicport", "tcp"]);
  }

  public readMemory(): string {
    return WindowsSocketReader.run("powershell", ["-NoProfile", "-NonInteractive", "-Command", WindowsSocketReader.MEMORY_SCRIPT]);
  }

  private static run(command: string, arguments_: readonly string[]): string {
    if (process.platform !== WindowsSocketReader.PLATFORM)
      throw new SocketStateException(WindowsSocketReader.OTHER_PLATFORM);
    try {
      return childProcess.execFileSync(command, arguments_, { encoding: WindowsSocketReader.ENCODING, timeout: WindowsSocketReader.TIMEOUT, windowsHide: true });
    }
    catch (error) {
      throw new SocketStateException(`Reading ${command} failed: ${error instanceof Error ? error.message : String(error)}`, new ExceptionOptions(error));
    }
  }
}
