/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";

import { UnconfirmedAction } from "../../../src/app/enums/unconfirmed-action";
import { ActionNotConfirmedException } from "../../../src/app/exceptions/action-not-confirmed.exception";
import { RuntimeDisconnectedException } from "../../../src/app/exceptions/runtime-disconnected.exception";
import { RuntimeRequestException } from "../../../src/app/exceptions/runtime-request.exception";

describe("ActionNotConfirmedException", () => {
  it("stands for a failure because the connection to the runtime ended, anywhere in its causes, with the action's message and the failure as its cause", () => {
    const disconnected = new RuntimeDisconnectedException("Noldova Desktop Sample is not connected to its runtime.");
    const wrapped = new Error("The note was not saved.", { cause: disconnected });

    const actions = [disconnected, wrapped].map(t => ActionNotConfirmedException.from(t, UnconfirmedAction.Command, "notes.save"));

    expect(actions.map(t => t instanceof ActionNotConfirmedException ? [t instanceof Exception, t.action, t.subject, t.message, t.cause] : t)).toEqual([
      [true, UnconfirmedAction.Command, "notes.save", "The command notes.save did not finish because the connection to the runtime ended.", disconnected],
      [true, UnconfirmedAction.Command, "notes.save", "The command notes.save did not finish because the connection to the runtime ended.", wrapped]
    ]);
  });

  it("says which setting or that the notifications' change was not confirmed", () => {
    const disconnected = new RuntimeDisconnectedException("Noldova Desktop Sample is not connected to its runtime.");

    const actions = [new ActionNotConfirmedException(UnconfirmedAction.Setting, "notes.wrap", disconnected), new ActionNotConfirmedException(UnconfirmedAction.Notifications, null, disconnected)];

    expect(actions.map(t => [t.action, t.subject, t.message])).toEqual([
      [UnconfirmedAction.Setting, "notes.wrap", "The runtime did not confirm the change to the setting notes.wrap because the connection to it ended."],
      [UnconfirmedAction.Notifications, null, "The runtime did not confirm the change to the notifications because the connection to it ended."]
    ]);
  });

  it("leaves any other failure as it is", () => {
    const values: unknown[] = [new RuntimeRequestException("Unavailable", "The runtime did not answer notes.save in time."), new Error("A defect."), "A thrown text."];

    expect(values.map(t => ActionNotConfirmedException.from(t, UnconfirmedAction.Command, "notes.save"))).toEqual(values);
  });
});
