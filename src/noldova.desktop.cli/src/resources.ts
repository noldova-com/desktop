/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ShellClients } from "@noldova/desktop.protocol";
import { ProductInfo } from "@noldova/desktop.runtime";

import { CliCommand } from "./enums/cli-command.js";

export class Resources {
  public static readonly statusCommand: string = "status";
  public static readonly commandsCommand: string = "commands";
  public static readonly runCommand: string = "run";
  public static readonly openCommand: string = "open";
  public static readonly quitCommand: string = "quit";
  public static readonly helpCommand: string = "help";
  public static readonly ownCommandNames: readonly string[] = [Resources.statusCommand, Resources.commandsCommand, Resources.runCommand, Resources.openCommand, Resources.quitCommand, Resources.helpCommand];
  public static readonly dataDirectoryOption: string = "data-dir";
  public static readonly deviceDirectoryOption: string = "device-dir";
  public static readonly jsonOption: string = "json";
  public static readonly noStartOption: string = "no-start";
  public static readonly takeOverOption: string = "take-over";
  public static readonly timeoutOption: string = "timeout";
  public static readonly argumentsFileOption: string = "args-file";
  public static readonly valueOptionNames: readonly string[] = [Resources.dataDirectoryOption, Resources.deviceDirectoryOption, Resources.timeoutOption, Resources.argumentsFileOption];
  public static readonly switchNames: readonly string[] = [Resources.jsonOption, Resources.noStartOption, Resources.takeOverOption, Resources.helpCommand];
  public static readonly clientName: string = ShellClients.commandLine;
  public static readonly runAsNodeVariable: string = "ELECTRON_RUN_AS_NODE";
  public static readonly runAsNodeValue: string = "1";
  public static readonly utf8Encoding: BufferEncoding = "utf8";
  public static readonly interruptSignals: readonly string[] = ["SIGINT", "SIGHUP"];
  public static readonly millisecondsPerSecond: number = 1_000;
  public static readonly minimumTimeoutSeconds: number = 1;
  public static readonly wholeSecondsPattern: RegExp = /^\d+$/;
  public static readonly maximumTimeoutSeconds: number = 3_600;
  public static readonly cleanupGraceMilliseconds: number = 5_000;
  public static readonly jsonIndent: number = 2;
  public static readonly codeParameterName: string = "code";
  public static readonly errorCodeField: "code" = "code";
  public static readonly nameParameterName: string = "name";
  public static readonly methodParameterName: string = "method";
  public static readonly nameSeparator: string = ".";
  public static readonly capitalPattern: RegExp = /[A-Z]/g;
  public static readonly wordSeparator: string = "-";
  public static readonly numberPattern: RegExp = /^-?(?!(?:\D*\d){16})\d+(?:\.\d+)?$/;
  public static readonly lineEnd: string = "\n";
  public static readonly lineEvent: string = "line";
  public static readonly closeEvent: string = "close";
  public static readonly abortEvent: string = "abort";
  public static readonly errorEvent: string = "error";
  public static readonly reasonSeparator: string = " ";
  public static readonly spawnEvent: string = "spawn";
  public static readonly ignoreStdio: "ignore" = "ignore";
  public static readonly listSeparator: string = ", ";
  public static readonly workSeparator: string = "; ";
  public static readonly nameField: string = "name";
  public static readonly descriptionField: string = "description";
  public static readonly summaryField: string = "summary";
  public static readonly requiredField: string = "required";
  public static readonly variadicField: string = "variadic";
  public static readonly argumentsField: string = "arguments";
  public static readonly optionsField: string = "options";
  public static readonly examplesField: string = "examples";
  public static readonly typeField: string = "type";
  public static readonly repeatedField: string = "repeated";
  public static readonly defaultField: string = "default";
  public static readonly cliPartExport: "CliPart" = "CliPart";
  public static readonly activateMember: "activateAsync" = "activateAsync";
  public static readonly deactivateMember: "deactivateAsync" = "deactivateAsync";
  public static readonly ownCommands: ReadonlyMap<string, Exclude<CliCommand, CliCommand.Module>> = new Map(Object.values(CliCommand)
    .filter((t): t is Exclude<CliCommand, CliCommand.Module> => t !== CliCommand.Module)
    .flatMap(t => Resources.ownCommandNames.filter(u => u === t.toLowerCase()).map(u => [u, t] satisfies [string, Exclude<CliCommand, CliCommand.Module>])));
  public static readonly flagPrefix: string = "--";
  public static readonly dataDirectoryFlag: string = `${Resources.flagPrefix}${Resources.dataDirectoryOption}`;
  public static readonly deviceDirectoryFlag: string = `${Resources.flagPrefix}${Resources.deviceDirectoryOption}`;
  public static readonly updateWait: number = 30000;
  public static readonly updateCheckInterval: number = 1000;
  public static readonly jsonFlag: string = `${Resources.flagPrefix}${Resources.jsonOption}`;
  public static readonly noStartFlag: string = `${Resources.flagPrefix}${Resources.noStartOption}`;
  public static readonly takeOverFlag: string = `${Resources.flagPrefix}${Resources.takeOverOption}`;
  public static readonly timeoutFlag: string = `${Resources.flagPrefix}${Resources.timeoutOption}`;
  public static readonly argumentsFileFlag: string = `${Resources.flagPrefix}${Resources.argumentsFileOption}`;
  public static readonly helpFlag: string = `${Resources.flagPrefix}${Resources.helpCommand}`;
  public static readonly inputArgument: string = "-";
  public static readonly valueSeparator: string = "=";
  public static readonly usageCode: string = "Usage";
  public static readonly noRuntimeCode: string = "NoRuntime";
  public static readonly buildMismatchCode: string = "BuildMismatch";
  public static readonly dataDirectoryUnusableCode: string = "DataDirectoryUnusable";
  public static readonly failedCode: string = "Failed";
  public static readonly moduleNotActiveCode: string = "ModuleNotActive";
  public static readonly partNotStoppedCode: string = "PartNotStopped";
  public static readonly unusableDirectoryErrorCodes: readonly string[] = ["EACCES", "EPERM", "EROFS", "ENOTDIR", "EEXIST"];
  public static readonly moduleCommandsTitle: string = "Module commands:";
  public static readonly commandsTitle: string = "Commands:";
  public static readonly argumentsTitle: string = "Arguments:";
  public static readonly optionsTitle: string = "Options:";
  public static readonly examplesTitle: string = "Examples:";
  public static readonly noModuleCommands: string = "It has no commands.";
  public static readonly helpIndent: string = "  ";
  public static readonly helpGap: string = "  ";
  public static readonly textPlaceholder: string = "<text>";
  public static readonly numberPlaceholder: string = "<number>";
  public static readonly repeatedSuffix: string = "...";
  public static readonly optionalArgument: string = "Optional.";
  public static readonly requiredOption: string = "Required.";
  public static readonly repeatedOption: string = "Repeatable.";
  public static readonly moduleNotInRuntime: string = "The runtime does not have it.";
  public static readonly cliPartMissing: string = "Its command-line part does not export a CliPart class with activateAsync and deactivateAsync.";
  public static readonly commandRequired: string = "A command is required.";
  public static readonly commandNameRequired: string = "The run command needs the name of a command to run.";
  public static readonly argumentsTwice: string = "The command's arguments were given more than once.";
  public static readonly timeoutInvalid: string = `The --timeout option takes a whole number of seconds from ${Resources.minimumTimeoutSeconds} to ${Resources.maximumTimeoutSeconds}.`;
  public static readonly noModules: string = "none";
  public static readonly noWork: string = "none";
  public static readonly noMainWindow: string = "none";
  public static readonly cancelled: string = "The command was cancelled.";
  public static readonly timedOut: string = "The command did not finish in time.";
  public static readonly runtimeGone: string = "The runtime went away while the command ran.";

  public static get productName(): string {
    return ProductInfo.current.name;
  }

  public static get productSlug(): string {
    return ProductInfo.current.slug;
  }

  public static get checkoutVariable(): string {
    return ProductInfo.current.checkoutVariable;
  }

  public static get mainProcessMainSegments(): readonly string[] {
    return ["node_modules", "@noldova", "desktop.electron", "main.js"];
  }

  public static get usage(): string {
    return [
      `Usage: ${Resources.productSlug} <command> [options]`,
      String.empty,
      "Commands:",
      `  ${Resources.statusCommand}                                   Reports the runtime, its modules and its work in progress. Never starts a runtime.`,
      `  ${Resources.commandsCommand}                                 Lists the runtime's commands.`,
      `  ${Resources.runCommand} <command> [<json> | ${Resources.argumentsFileFlag} <path> | ${Resources.inputArgument}]`,
      "                                           Runs a runtime command with its arguments, printing its result.",
      `  ${Resources.openCommand}                                     Starts ${Resources.productName} or brings its window forward.`,
      `  ${Resources.quitCommand}                                     Quits the running ${Resources.productName} as its Quit does. Never starts a runtime.`,
      `  ${Resources.helpCommand} [<module> [<command>]]              Prints this help, a module's commands or one command's help.`,
      "  <module> <command> [<argument>...]       Runs a module's command with its arguments and options.",
      String.empty,
      "Options:",
      `  ${Resources.dataDirectoryFlag} <path>   The data directory to use.`,
      `  ${Resources.deviceDirectoryFlag} <path> The device folder to use.`,
      `  ${Resources.jsonFlag}              Prints one JSON value on standard output, and errors as JSON on standard error.`,
      `  ${Resources.noStartFlag}          Fails instead of starting a runtime when none is running (commands, run, module commands).`,
      `  ${Resources.takeOverFlag}         Asks another build's idle runtime to stop and takes its place (commands, run, module commands).`,
      `  ${Resources.timeoutFlag} <seconds> How long a command may run (run, quit, module commands).`,
      `  ${Resources.helpFlag}              Prints the help of the command it follows.`,
      String.empty,
      "Exit codes: 0 success, 1 the command failed, 2 usage, 3 no runtime running, 4 another build's runtime,",
      `5 data directory unusable, 6 timed out or cancelled, 7 module not active, 8 ${Resources.productName} is installing an update,`,
      "9 a module command ran but a command-line part failed to stop."
    ].join(Resources.lineEnd);
  }

  public static get windowCommandsNote(): string {
    return `Commands of ${Resources.productName}'s window are not reachable from the command line.`;
  }

  public static get mainProcessNotStarted(): string {
    return `${Resources.productName} could not be started.`;
  }

  public static get quitDone(): string {
    return `${Resources.productName} quit.`;
  }

  public static get noMainProcess(): string {
    return "No main process is running.";
  }

  public static formatUnknownCommand(command: string): string {
    return `"${command}" is not a command.`;
  }

  public static formatUnknownOption(option: string): string {
    return `"${option}" is not an option.`;
  }

  public static formatOptionNotForCommand(option: string, word: string): string {
    return `The ${option} option does not apply to ${word}.`;
  }

  public static formatOptionNeedsValue(option: string): string {
    return `The ${option} option needs a value.`;
  }

  public static formatUnexpectedArgument(argument: string): string {
    return `"${argument}" was not expected.`;
  }

  public static formatArgumentsInvalid(reason: string): string {
    return `The command's arguments are not valid JSON: ${reason}`;
  }

  public static formatArgumentsFileUnreadable(file: string, reason: string): string {
    return `The arguments file ${file} could not be read: ${reason}`;
  }

  public static formatDataDirectoryUnusable(reason: string): string {
    return `The data directory cannot be used: ${reason}`;
  }

  public static formatRuntime(productVersion: string, fingerprint: string): string {
    return `Runtime: ${Resources.productName} ${productVersion} (build ${fingerprint})`;
  }

  public static formatDataDirectory(root: string): string {
    return `Data directory: ${root}`;
  }

  public static formatModules(modules: string): string {
    return `Modules: ${modules}`;
  }

  public static formatModule(id: string, state: string, cause: string | null): string {
    return Object.isNull(cause) ? `${id} (${state.toLowerCase()})` : `${id} (${state.toLowerCase()}: ${cause})`;
  }

  public static formatWork(work: string): string {
    return `Work in progress: ${work}`;
  }

  public static formatMainWindow(window: string): string {
    return `Main window: ${window}`;
  }

  public static formatShownWindow(title: string, isVisible: boolean): string {
    return `${JSON.stringify(title)} (${isVisible ? "shown" : "hidden"})`;
  }

  public static formatOpened(root: string): string {
    return `${Resources.productName} is opening with ${root}.`;
  }

  public static formatWord(name: string): string {
    return name.replace(Resources.capitalPattern, t => `${Resources.wordSeparator}${t.toLowerCase()}`);
  }

  public static formatCliCommandsUnreadable(file: string, reason: string): string {
    return `The module declarations ${file} hold command-line commands that are not valid: ${reason}`;
  }

  public static formatCliCommandPath(moduleId: string, index: number): string {
    return `${moduleId}.cliCommands.${index}`;
  }

  public static formatOptionNotForModuleCommands(option: string): string {
    return `The ${option} option does not apply to module commands.`;
  }

  public static formatUnknownModuleCommand(word: string, moduleId: string): string {
    return `"${word}" is not a command of ${moduleId}.`;
  }

  public static formatModuleCommandRequired(moduleId: string): string {
    return `${moduleId} needs one of its commands.`;
  }

  public static formatOptionTakesNoValue(option: string): string {
    return `The ${option} option takes no value.`;
  }

  public static formatOptionNotNumber(option: string, value: string): string {
    return `The ${option} option takes a number of at most 15 digits, not "${value}".`;
  }

  public static formatOptionRepeated(option: string): string {
    return `The ${option} option was given more than once.`;
  }

  public static formatArgumentRequired(placeholder: string): string {
    return `The ${placeholder} argument is required.`;
  }

  public static formatOptionRequired(option: string): string {
    return `The ${option} option is required.`;
  }

  public static formatModuleNotActive(moduleId: string, reason: string): string {
    return `The module ${moduleId} is not active: ${reason}`;
  }

  public static formatModuleOff(switchSetting: string): string {
    return `It is off; the setting ${switchSetting} turns it on.`;
  }

  public static formatReason(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  public static formatCliPartFailed(reason: string): string {
    return `Its command-line part failed to start: ${reason}`;
  }

  public static formatCliPartStopFailed(reasons: string): string {
    return `A command-line part failed to stop: ${reasons}`;
  }

  public static formatCommandFailed(reason: string): string {
    return `The command failed: ${reason}`;
  }

  public static formatCommandNotRegistered(name: string): string {
    return `Its command-line part did not register ${name}.`;
  }

  public static formatCommandNotDeclared(name: string, moduleId: string): string {
    return `${name} is not a command-line command that ${moduleId} declares.`;
  }

  public static formatSecretNotOwn(moduleId: string, name: string): string {
    return `The module ${moduleId} may only use its own secrets, not ${name}.`;
  }

  public static formatMethodNotReachable(method: string, moduleId: string): string {
    return `${method} is not a method of ${moduleId} or of a module it depends on.`;
  }

  public static formatCommandRegisteredTwice(name: string): string {
    return `${name} is registered already.`;
  }

  public static formatModuleHeading(displayName: string, description: string): string {
    return `${displayName}: ${description}`;
  }

  public static formatModuleUsage(moduleId: string): string {
    return `Usage: ${Resources.productSlug} ${moduleId} <command> [options]`;
  }

  public static formatCommandUsage(moduleId: string, word: string, syntax: readonly string[]): string {
    return [`Usage: ${Resources.productSlug} ${moduleId} ${word}`, ...syntax].join(" ");
  }

  public static formatModuleHelpHint(moduleId: string): string {
    return `Run "${Resources.productSlug} help ${moduleId} <command>" for a command's arguments and options.`;
  }

  public static formatModuleCommand(moduleId: string, word: string): string {
    return `${Resources.productSlug} ${moduleId} ${word}`;
  }

  public static formatExample(moduleId: string, word: string, exampleArguments: string): string {
    return [Resources.productSlug, moduleId, word, exampleArguments].filter(t => t.length > 0).join(" ");
  }

  public static formatOptional(syntax: string): string {
    return `[${syntax}]`;
  }

  public static formatArgumentPlaceholder(name: string): string {
    return `<${name}>`;
  }

  public static formatOptionalDescription(description: string): string {
    return `${description} ${Resources.optionalArgument}`;
  }

  public static formatOptionValue(flag: string, placeholder: string): string {
    return `${flag} ${placeholder}`;
  }

  public static formatCommandRow(name: string, width: number, title: string): string {
    return `${name.padEnd(width)}  ${title}`;
  }

  public static formatFailure(failure: string): string {
    return `${failure}${Resources.lineEnd}`;
  }

  public static formatDefault(value: string): string {
    return `Default: ${value}.`;
  }

  public static formatInstallationUnwatched(folder: string, interval: number, reason: string): string {
    return `The folder ${folder} could not be watched for changes, so the command line checks whether the update has ended every ${interval} ms instead: ${reason}`;
  }
}
