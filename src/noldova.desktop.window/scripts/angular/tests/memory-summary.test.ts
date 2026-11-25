/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { describe, it } from "node:test";

import "@noldova/context.core";

import { MemorySummary } from "../memory-summary.ts";
import { SocketStateException } from "../socket-state.exception.ts";
import { WindowsSocketReader } from "../windows-socket.reader.ts";

const MEMORY = [
  "pool 157286400",
  "process chrome-headless-shell 9488 812 314572800",
  "process node 4304 640 209715200",
  "process chrome-headless-shell 9500 200 104857600",
  "Get-Process : something it printed besides",
  ""
].join("\r\n");

describe("MemorySummary", () => {
  it("gives the non-paged pool and each process name's count, handles and working set in megabytes, by name", () => {
    assert.equal(MemorySummary.format(MEMORY),
      "non-paged pool 150.0 MB; chrome-headless-shell 2 processes, 1012 handles, 400.0 MB working set; node 1 process, 640 handles, 200.0 MB working set");
  });

  it("says when it found no pool and no chrome or node process", () => {
    assert.equal(MemorySummary.format("Get-CimInstance : Access denied\r\n"), "non-paged pool unread; no chrome or node process");
  });
});

describe("WindowsSocketReader's memory", () => {
  it("reads the non-paged pool and the chrome and node processes on Windows, and refuses elsewhere", () => {
    const read = (): string => {
      try {
        return MemorySummary.format(new WindowsSocketReader().readMemory()).startsWith("non-paged pool unread") ? "unread" : "read";
      }
      catch (error) {
        return error instanceof SocketStateException ? error.message : "not a SocketStateException";
      }
    };

    assert.equal(read(), process.platform === "win32" ? "read" : "Socket state is read on Windows only.");
  });

  it("wraps a PowerShell that fails in a SocketStateException naming it, with the failure as its cause", t => {
    t.mock.property(process, "platform", "win32");
    const failure = new Error("spawnSync powershell ETIMEDOUT");
    t.mock.method(childProcess, "execFileSync", () => {
      throw failure;
    });

    assert.throws(() => new WindowsSocketReader().readMemory(),
      (error: unknown) => error instanceof SocketStateException && error.message === "Reading powershell failed: spawnSync powershell ETIMEDOUT" && error.cause === failure);
  });
});
