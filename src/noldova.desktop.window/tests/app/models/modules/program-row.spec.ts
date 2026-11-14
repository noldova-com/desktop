/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProgramStatus } from "@noldova/desktop.protocol";

import { ProgramRow } from "../../../../src/app/models/modules/program-row";

describe("ProgramRow", () => {
  const started = new Date("2026-10-06T08:00:00.000Z");
  const time = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
  const row = (program: string, minutes: number, hasExited: boolean = false): ProgramRow =>
    ProgramRow.from(new ProgramStatus("git", program, 4210, started, hasExited), started.getTime() + minutes * 60_000, time);

  it("names a program by its file name and keeps its full path, and its details name the path, its process and its start", () => {
    const posix = row("/usr/bin/git", 3);
    const windows = row("C:\\Program Files\\Git\\cmd\\git.exe", 3);

    expect([posix.name, posix.path, posix.processId]).toEqual(["git", "/usr/bin/git", 4210]);
    expect([windows.name, windows.path]).toEqual(["git.exe", "C:\\Program Files\\Git\\cmd\\git.exe"]);
    expect([row("git/", 3).name, row("/", 3).name]).toEqual(["git", "/"]);
    expect(posix.details).toBe(`/usr/bin/git · Process 4210, started ${time.format(started)}`);
  });

  it("says how long a program has run in whole minutes, never less than none, and that an exited one's processes still run", () => {
    expect([row("git", 0.99).state, row("git", 3.5).state, row("git", -2).state]).toEqual(["Less than a minute", "3 min", "Less than a minute"]);
    expect([row("git", 90, true).state, row("git", 90, true).details]).toEqual(["Exited, its processes still run", `git · Process 4210, started ${time.format(started)}`]);
  });
});
