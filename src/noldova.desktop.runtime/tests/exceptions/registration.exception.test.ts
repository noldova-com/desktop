/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  AnswererRegisteredException, CommandRegisteredException, EventDeclaredException, EventWithdrawnException, MethodRegisteredException, NotContributedException, NotificationCommandNotAllowedException,
  NotificationKindChangedException, RegistrationException, RuntimeException, SecretNotOwnedException, ServiceNotOwnedException, ServicePublishedException, SettingNotReadableException, SettingNotWritableException,
  SettingScopeNotOwnedException, ToolRegisteredException
} from "@noldova/desktop.runtime";

@TestClass
export class RegistrationExceptionTests {
  @TestMethod
  public isTheCategoryOfEachRefusedRegistration(): void {
    const exceptions: readonly RuntimeException[] = [
      new NotContributedException("notes", "commands", "notes.open"),
      new ServiceNotOwnedException("notes", "tasks.store"),
      new CommandRegisteredException("notes.open"),
      new MethodRegisteredException("notes.open"),
      new EventDeclaredException("notes.saved"),
      new EventWithdrawnException("notes.saved"),
      new ServicePublishedException("notes.store"),
      new ToolRegisteredException("notes.search"),
      new NotificationKindChangedException("n-1", "notes.saved"),
      new NotificationCommandNotAllowedException("notes", "tasks.open"),
      new AnswererRegisteredException("notes"),
      new SecretNotOwnedException("notes", "tasks.token"),
      new SettingNotReadableException("notes", "tasks.speed"),
      new SettingNotWritableException("notes", "tasks.speed"),
      new SettingScopeNotOwnedException("notes", "tasks.board")
    ];

    for (const exception of exceptions)
      Assert.isInstanceOf(exception, RegistrationException, exception.name);
  }
}
