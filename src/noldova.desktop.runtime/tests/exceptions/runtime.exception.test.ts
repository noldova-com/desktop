/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Exception, ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  AddonIncompleteException, AgentControlException, AgentControlFailure, BackupVerificationException, DeclarationFieldInvalidException, DiscoveryFieldInvalidException,
  HandshakeTimedOutException, LaunchTimedOutException, MethodRegisteredException, ModuleLoadException, OwnershipReleasedException,
  PermissionsClosedException, ProductFileException, ProgramNotFoundException, RuntimeException, ServiceMissingException,
  SettingUnknownException, SystemRootMissingException, ToolEndpointException, UnknownSchemaException,
  UnknownSchemaFailure
} from "@noldova/desktop.runtime";

@TestClass
export class RuntimeExceptionTests {
  @TestMethod
  public keepsTheMessageAndTheCause(): void {
    const cause = new Error("The disk is full.");

    const exception = new RuntimeException("The runtime could not finish the request.", new ExceptionOptions(cause));

    Assert.areEqual("The runtime could not finish the request.", exception.message);
    Assert.areEqual(cause, exception.cause);
    Assert.areEqual("RuntimeException", exception.name);
    Assert.isTrue(exception instanceof Exception);
  }

  @TestMethod
  public isTheBaseOfThePackagesExceptions(): void {
    const exceptions: readonly Exception[] = [
      new AddonIncompleteException("win32-x64/windows-process.node"),
      new AgentControlException(AgentControlFailure.ResumeRefused, "notes"),
      new BackupVerificationException(),
      new HandshakeTimedOutException(),
      new DeclarationFieldInvalidException("id"),
      new DiscoveryFieldInvalidException("token"),
      new LaunchTimedOutException(),
      new ModuleLoadException(),
      new OwnershipReleasedException(),
      new PermissionsClosedException(),
      new ProgramNotFoundException("git"),
      new ProductFileException("product.json", null),
      new MethodRegisteredException("notes.open"),
      new ServiceMissingException("tasks.store"),
      new SettingUnknownException("chat.send"),
      new SystemRootMissingException(),
      new ToolEndpointException(),
      new UnknownSchemaException(UnknownSchemaFailure.HistoryNewer, "shell database")
    ];

    for (const exception of exceptions) {
      Assert.isTrue(exception instanceof RuntimeException, exception.name);
    }
  }
}
