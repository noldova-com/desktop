/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "@playwright/test";

import { ErrorOutputClassifier } from "./fixtures/error-output.classifier.ts";

test.describe("the harness's reading of the main process's error output", () => {
  const warning = "(electron:226035): Gtk-WARNING **: 21:13:15.015: Could not load a pixbuf from icon theme.";
  const continuation = "This may indicate that pixbuf loaders or the mime database could not be found.";

  test("a GTK warning with its continuation line is a platform log, even when the lines arrive apart", () => {
    const together = new ErrorOutputClassifier().classify(`${warning}\n${continuation}\n`);
    const classifier = new ErrorOutputClassifier();
    const apart = [...classifier.classify(`${warning}\n`), ...classifier.classify(`${continuation}\n`)];

    expect(together).toEqual([{ kind: "platform-log", text: warning }, { kind: "platform-log", text: continuation }]);
    expect(apart).toEqual(together);
    expect(new ErrorOutputClassifier().classify(`${warning.replace("electron", "fixture-studio")}\n${continuation}\n`).map(t => t.kind)).toEqual(["platform-log", "platform-log"]);
  });

  test("a macOS service line is a platform log, whatever the application's name, and Chromium's own lines are expected", () => {
    const service = "2026-10-02 03:20:40.123 Electron Helper (Renderer)[1234:5678] XPC connection interrupted";
    const named = "2026-10-02 03:20:41.456 Fixture Studio Helper (GPU)[1234:5679] XPC connection interrupted";

    expect(new ErrorOutputClassifier().classify(`[1:0102/030405.678:ERROR:thing] x\nDebugger listening on ws://127.0.0.1:1/x\nFor help, see: y\n${service}\n${named}\n`))
      .toEqual([{ kind: "platform-log", text: service }, { kind: "platform-log", text: named }]);
  });

  test("Node's debugger lines are expected, including the wait for the debugger to disconnect as the process exits", () => {
    expect(new ErrorOutputClassifier().classify("Debugger attached.\nWaiting for the debugger to disconnect...\nDebugger ending on ws://127.0.0.1:1/x\n")).toEqual([]);
  });

  test("Chromium's stack dump is a crash from its signal line to its end line, even when the lines arrive apart, and the output after it fails again", () => {
    const dump = [
      "Received signal 11 SEGV_MAPERR 000000000010",
      "#0 0x55d0c3a1b8ac (/opt/app/noldova-desktop+0x93be8ac)",
      "#1 0x55d0c2f00123 (/opt/app/noldova-desktop+0x8a03123)",
      "r8: 0000000000000000  r9: 00007ffd5c1b2a40 r10: 0000000000000008 r11: 0000000000000246",
      "efl: 0000000000010246 cgf: 002b000000000033 erf: 0000000000000004 trp: 000000000000000e",
      "[end of stack trace]"
    ];
    const together = new ErrorOutputClassifier().classify(`${dump.join("\n")}\nError: boom\n`);
    const classifier = new ErrorOutputClassifier();
    const apart = dump.flatMap(t => classifier.classify(`${t}\n`));

    expect(together).toEqual([...dump.map(t => ({ kind: "crash", text: t })), { kind: "failure", text: "Error: boom" }]);
    expect(apart).toEqual(together.slice(0, -1));
  });

  test("a line split across chunks is read whole, and the last line without a line break is read when the output ends", () => {
    const classifier = new ErrorOutputClassifier();
    const read = [
      ...classifier.classify("Received signal 7 <unknown> 000000000000\n#2"),
      ...classifier.classify(" 0x7d0370a45cb0 (/usr/lib/x86_64-linux-gnu/libc.so.6+0x45caf)\n#3 0x55d0c3a1b8ac"),
      ...classifier.classify(" (/opt/app/noldova-desktop+0x64c9735)\n[end of stack trace]\nError: bo"),
      ...classifier.classify("om")
    ];

    expect(read.map(t => t.kind)).toEqual(["crash", "crash", "crash", "crash"]);
    expect(read[1]?.text).toBe("#2 0x7d0370a45cb0 (/usr/lib/x86_64-linux-gnu/libc.so.6+0x45caf)");
    expect(classifier.flush()).toEqual([{ kind: "failure", text: "Error: boom" }]);
    expect(classifier.flush()).toEqual([]);
  });

  test("every line from the signal line to the end line is the crash, whatever its form, and a dump the process's end cuts off is the crash to its last line", () => {
    const ended = new ErrorOutputClassifier();
    const cut = new ErrorOutputClassifier();

    expect(ended.classify("Received signal 7 <unknown> 000000000000\n#21  (/opt/app/noldova-desktop+0x5670ef7)\nany text\n[end of stack trace]\nError: boom\n").map(t => t.kind))
      .toEqual(["crash", "crash", "crash", "crash", "failure"]);
    expect([...cut.classify("Received signal 7 <unknown> 000000000000\n#0 0x55d0c3a1b8ac (/opt/app/noldova-desktop+0x93be8ac)\n#1 0x55d0c2f0"), ...cut.flush()].map(t => t.kind))
      .toEqual(["crash", "crash", "crash"]);
  });

  test("a dump that never prints its end line is the crash for its signal line and the 299 lines after it, and the output after those fails again", () => {
    const classifier = new ErrorOutputClassifier();
    const frames = Array.from({ length: 299 }, (_, i) => `#${i} 0x55d0c3a1b8ac (/opt/app/noldova-desktop+0x93be8ac)`);
    const read = classifier.classify(`Received signal 7 <unknown> 000000000000\n${frames.join("\n")}\nError: boom\nReceived signal 11 <unknown> 000000000000\n[end of stack trace]\n`);

    expect(read.map(t => t.kind)).toEqual([...Array.from({ length: 300 }, () => "crash"), "failure", "crash", "crash"]);
    expect(read[300]?.text).toBe("Error: boom");
  });

  test("any other output still fails, including GTK's continuation text without a GTK warning before it", () => {
    const classifier = new ErrorOutputClassifier();

    expect(classifier.classify("Error: boom\n")).toEqual([{ kind: "failure", text: "Error: boom" }]);
    expect(classifier.classify(`${continuation}\n`)).toEqual([{ kind: "failure", text: continuation }]);
    expect(classifier.classify(`${warning}\nError: boom\n(electron:1): Gtk-CRITICAL **: broken\n${continuation}\n`).map(t => t.kind))
      .toEqual(["platform-log", "failure", "failure", "failure"]);
  });
});
