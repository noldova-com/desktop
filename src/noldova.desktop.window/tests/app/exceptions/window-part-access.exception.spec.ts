/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CommandAlreadyRegisteredException } from "../../../src/app/exceptions/command-already-registered.exception";
import { CommandNotDeclaredException } from "../../../src/app/exceptions/command-not-declared.exception";
import { ContributionNotDeclaredException } from "../../../src/app/exceptions/contribution-not-declared.exception";
import { ContributionRegisteredException } from "../../../src/app/exceptions/contribution-registered.exception";
import { ForeignContributionException } from "../../../src/app/exceptions/foreign-contribution.exception";
import { ForeignNameException } from "../../../src/app/exceptions/foreign-name.exception";
import { ForeignSecretException } from "../../../src/app/exceptions/foreign-secret.exception";
import { PlaceholderShownException } from "../../../src/app/exceptions/placeholder-shown.exception";
import { SearchSourceRegisteredException } from "../../../src/app/exceptions/search-source-registered.exception";
import { WindowPartAccessException } from "../../../src/app/exceptions/window-part-access.exception";

describe("WindowPartAccessException", () => {
  it("is the base of every refusal, each naming the module, keeping its facts and saying what is refused", () => {
    const notDeclared = new ContributionNotDeclaredException("notes", "notes.outline", "view");
    const commandNotDeclared = new CommandNotDeclaredException("notes", "notes.delete");
    const registered = new ContributionRegisteredException("notes", "notes.list", "view");
    const commandRegistered = new CommandAlreadyRegisteredException("notes", "notes.taken");
    const sourceRegistered = new SearchSourceRegisteredException("notes", "notes.notes");
    const placeholder = new PlaceholderShownException("notes", "notes.start", "clock.start");
    const foreignContribution = new ForeignContributionException("notes", "clock.face");
    const foreignName = new ForeignNameException("notes", "clock.time");
    const foreignSecret = new ForeignSecretException("notes", "clock.token");
    const exceptions = [notDeclared, commandNotDeclared, registered, commandRegistered, sourceRegistered, placeholder, foreignContribution, foreignName, foreignSecret];

    expect(exceptions.map(t => [t instanceof WindowPartAccessException, t.moduleId, t.cause, t.name, t.message])).toEqual([
      [true, "notes", undefined, "ContributionNotDeclaredException", "The module notes does not declare the view notes.outline."],
      [true, "notes", undefined, "CommandNotDeclaredException", "The module notes does not declare the command notes.delete."],
      [true, "notes", undefined, "ContributionRegisteredException", "The view notes.list is already registered."],
      [true, "notes", undefined, "CommandAlreadyRegisteredException", "The command notes.taken is already registered."],
      [true, "notes", undefined, "SearchSourceRegisteredException", "The search source notes.notes is already registered."],
      [true, "notes", undefined, "PlaceholderShownException", "The placeholder notes.start is refused, since the window shows one and clock.start is already registered."],
      [true, "notes", undefined, "ForeignContributionException", "The module notes may contribute only names of its own, not clock.face."],
      [true, "notes", undefined, "ForeignNameException", "The module notes may use only its own methods and events and those of the modules it depends on, not clock.time."],
      [true, "notes", undefined, "ForeignSecretException", "The module notes may only use its own secrets, not clock.token."]
    ]);
    expect([
      notDeclared.contribution, notDeclared.kind, commandNotDeclared.command, registered.contribution, registered.kind, commandRegistered.command, sourceRegistered.source,
      placeholder.placeholder, placeholder.registered, foreignContribution.contribution, foreignName.contributionName, foreignSecret.secret
    ]).toEqual(["notes.outline", "view", "notes.delete", "notes.list", "view", "notes.taken", "notes.notes", "notes.start", "clock.start", "clock.face", "clock.time", "clock.token"]);
  });
});
