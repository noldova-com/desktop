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
  "",
  "\"(PDH-CSV 4.0)\",\"\\\\HOST\\Memory\\Pool Nonpaged Bytes\",\"\\\\HOST\\Process(chrome-headless-shell)\\Handle Count\",\"\\\\HOST\\Process(node)\\Handle Count\","
    + "\"\\\\HOST\\Process(chrome-headless-shell#1)\\Handle Count\",\"\\\\HOST\\Process(svchost)\\Handle Count\",\"\\\\HOST\\Process(_Total)\\Handle Count\","
    + "\"\\\\HOST\\Process(chrome-headless-shell)\\Working Set\",\"\\\\HOST\\Process(node)\\Working Set\",\"\\\\HOST\\Process(chrome-headless-shell#1)\\Working Set\",\"\\\\HOST\\Process(node#1)\\Working Set\"",
  "\"11/25/2026 01:43:28.123\",\"157286400.000000\",\"812.000000\",\"640.000000\",\"200.000000\",\"999.000000\",\"90000.000000\",\"314572800.000000\",\"209715200.000000\",\"104857600.000000\",\" \"",
  "Exiting, please wait...",
  "The command completed successfully.",
  ""
].join("\r\n");

describe("MemorySummary", () => {
  it("gives the non-paged pool and each chrome or node process name's count, handles and working set in megabytes, by name, leaving out other processes and blank values", () => {
    assert.equal(MemorySummary.format(MEMORY),
      "non-paged pool 150.0 MB; chrome-headless-shell 2 processes, 1012 handles, 400.0 MB working set; node 1 process, 640 handles, 200.0 MB working set");
  });

  it("says when it found no pool and no chrome or node process", () => {
    assert.equal(MemorySummary.format("Error: No valid counters.\r\n"), "non-paged pool unread; no chrome or node process");
  });

  it("reads no values when the header has no row after it", () => {
    assert.equal(MemorySummary.format("\"(PDH-CSV 4.0)\",\"\\\\HOST\\Memory\\Pool Nonpaged Bytes\""), "non-paged pool unread; no chrome or node process");
  });
});

describe("WindowsSocketReader's memory", () => {
  it("reads the non-paged pool and the chrome and node processes on Windows, the test's own node among them, and refuses elsewhere", () => {
    const read = (): string => {
      try {
        const summary = MemorySummary.format(new WindowsSocketReader().readMemory());
        return [summary.startsWith("non-paged pool unread") ? "pool unread" : "pool read", /; node \d+ process/u.test(summary) ? "node read" : "node unread"].join(", ");
      }
      catch (error) {
        return error instanceof SocketStateException ? error.message : "not a SocketStateException";
      }
    };

    assert.equal(read(), process.platform === "win32" ? "pool read, node read" : "Socket state is read on Windows only.");
  });

  it("wraps a typeperf that fails in a SocketStateException naming it, with the failure as its cause", t => {
    t.mock.property(process, "platform", "win32");
    const failure = new Error("spawnSync typeperf ETIMEDOUT");
    t.mock.method(childProcess, "execFileSync", () => {
      throw failure;
    });

    assert.throws(() => new WindowsSocketReader().readMemory(),
      (error: unknown) => error instanceof SocketStateException && error.message === "Reading typeperf failed: spawnSync typeperf ETIMEDOUT" && error.cause === failure);
  });
});
