/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonValue } from "@noldova/context.json";

import { WindowPartAccessException } from "../../../src/app/exceptions/window-part-access.exception";
import { WindowSecrets } from "../../../src/app/models/window-secrets";

describe("WindowSecrets", () => {
  let requests: [string, JsonValue][];
  let answer: JsonValue;
  let secrets: WindowSecrets;

  beforeEach(() => {
    requests = [];
    answer = null;
    secrets = new WindowSecrets("notes", (method, payload) => {
      requests.push([method, payload]);
      return Promise.resolve(answer);
    });
  });

  it("saves, removes and checks its own module's secrets through the runtime", async () => {
    await secrets.saveAsync("notes.syncToken", "s3cret");
    await secrets.removeAsync("notes.syncToken");
    answer = true;
    const isSet = await secrets.isSetAsync("notes.syncToken");
    answer = false;

    expect([isSet, await secrets.isSetAsync("notes.syncToken")]).toEqual([true, false]);
    expect(requests).toEqual([
      ["desktop.saveSecret", { name: "notes.syncToken", value: "s3cret" }],
      ["desktop.removeSecret", { name: "notes.syncToken" }],
      ["desktop.secretStatus", { name: "notes.syncToken" }],
      ["desktop.secretStatus", { name: "notes.syncToken" }]
    ]);
    expect("readAsync" in secrets).toBe(false);
  });

  it("refuses another module's name, Noldova Desktop's, a name that isn't qualified and a value it can't keep, before asking", async () => {
    await expect(secrets.saveAsync("tasks.token", "s3cret")).rejects.toThrowError("The module notes may only use its own secrets, not tasks.token.");
    await expect(secrets.removeAsync("desktop.token")).rejects.toThrowError(WindowPartAccessException);
    await expect(secrets.isSetAsync("tasks.token")).rejects.toThrowError(WindowPartAccessException);
    await expect(secrets.isSetAsync("token")).rejects.toThrowError(ArgumentException);
    await expect(secrets.saveAsync("notes.syncToken", String.empty)).rejects.toThrowError(ArgumentException);
    const long = "s".repeat(16385);
    const failure: unknown = await secrets.saveAsync("notes.syncToken", long).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ArgumentException);
    expect(failure instanceof Error && failure.message.includes(long)).toBe(false);
    expect(requests).toEqual([]);
  });

  it("passes on the runtime's refusal", async () => {
    secrets = new WindowSecrets("notes", () => Promise.reject(new Error("This machine has no keyring that protects secrets, so nothing was saved.")));

    await expect(secrets.saveAsync("notes.syncToken", "s3cret")).rejects.toThrowError("This machine has no keyring that protects secrets, so nothing was saved.");
  });
});
