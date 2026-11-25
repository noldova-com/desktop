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

import { SocketStateException } from "../socket-state.exception.ts";
import { SocketSummary } from "../socket-summary.ts";
import { WindowsSocketReader } from "../windows-socket.reader.ts";
import { ExecCall } from "./fixtures/exec-call.ts";
import { ExecPassThroughFixture } from "./fixtures/exec-pass-through.fixture.ts";

const CONNECTIONS = [
  "",
  "Active Connections",
  "",
  "  Proto  Local Address          Foreign Address        State           PID",
  "  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1040",
  "  TCP    127.0.0.1:24326        0.0.0.0:0              LISTENING       5120",
  "  TCP    127.0.0.1:24326        127.0.0.1:50123        ESTABLISHED     5120",
  "  TCP    127.0.0.1:50123        127.0.0.1:24326        ESTABLISHED     7300",
  "  TCP    127.0.0.1:24326        127.0.0.1:50124        TIME_WAIT       0",
  "  TCP    127.0.0.1:24326        127.0.0.1:50125        TIME_WAIT       0",
  "  TCP    127.0.0.1:51000        127.0.0.1:443          TIME_WAIT       0",
  "  TCP    10.1.0.4:52000         20.60.1.2:443          ESTABLISHED     7300",
  ""
].join("\r\n");

const PORT_RANGE = "\r\nProtocol tcp Dynamic Port Range\r\n---------------------------------\r\nStart Port      : 49152\r\nNumber of Ports : 16384\r\n";

describe("SocketSummary", () => {
  it("counts Windows' TCP sockets by state, those to or from the test server's port, the processes holding the most outside TIME_WAIT, and the dynamic port range", () => {
    assert.equal(SocketSummary.format(CONNECTIONS, PORT_RANGE, 24326),
      "8 TCP sockets, ESTABLISHED 3, TIME_WAIT 3, LISTENING 2; to or from port 24326: ESTABLISHED 2, TIME_WAIT 2, LISTENING 1; most held outside TIME_WAIT by process 5120 (2), 7300 (2), 1040 (1); dynamic ports from 49152, 16384 of them");
  });

  it("says none for counts it found nothing for, and that it couldn't read a port range it doesn't recognize", () => {
    assert.equal(SocketSummary.format("Active Connections\r\n", "The requested operation requires elevation.", 24326),
      "0 TCP sockets, none; to or from port 24326: none; most held outside TIME_WAIT by process none; dynamic port range unread");
  });
});

describe("WindowsSocketReader", () => {
  it("reads the TCP connections and the dynamic port range on Windows, asking for a 10 s limit on each command, and refuses elsewhere", { timeout: ExecPassThroughFixture.TEST_LIMIT }, t => {
    const exec = new ExecPassThroughFixture(t);
    const reader = new WindowsSocketReader();
    const read = (): string => {
      try {
        return SocketSummary.format(reader.readConnections(), reader.readPortRange(), 24326).includes("dynamic ports from") ? "read" : "unread";
      }
      catch (error) {
        return error instanceof SocketStateException ? error.message : "not a SocketStateException";
      }
    };

    assert.equal(read(), process.platform === "win32" ? "read" : "Socket state is read on Windows only.");
    assert.deepEqual(exec.calls, process.platform === "win32" ? [new ExecCall("netstat", ["-ano", "-p", "tcp"], 10_000), new ExecCall("netsh", ["int", "ipv4", "show", "dynamicport", "tcp"], 10_000)] : []);
  });

  it("wraps a command that fails in a SocketStateException naming the command, with the failure as its cause", t => {
    t.mock.property(process, "platform", "win32");
    const timeout = new Error("spawnSync netstat ETIMEDOUT");
    const failures: unknown[] = [timeout, "busy"];
    t.mock.method(childProcess, "execFileSync", () => {
      throw failures.shift();
    });
    const reader = new WindowsSocketReader();

    assert.throws(() => reader.readConnections(), (error: unknown) => error instanceof SocketStateException && error.message === "Reading netstat failed: spawnSync netstat ETIMEDOUT" && error.cause === timeout);
    assert.throws(() => reader.readPortRange(), (error: unknown) => error instanceof SocketStateException && error.message === "Reading netsh failed: busy" && error.cause === "busy");
  });
});
