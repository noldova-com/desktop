/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ExceptionOptions } from "@noldova/context.exceptions";
import { JsonException, JsonReader, type JsonValue } from "@noldova/context.json";
import { SettingDefinition, SettingKind, SettingLocality, WebViewDeclaration } from "@noldova/desktop.protocol";

import { DeclarationFieldInvalidException } from "../exceptions/declaration-field-invalid.exception.js";
import { DeclarationNotObjectException } from "../exceptions/declaration-not-object.exception.js";
import { ModuleIdDeviceException } from "../exceptions/module-id-device.exception.js";
import { Resources } from "../resources.js";
import { WindowsDeviceNames } from "./windows-device-names.js";

export class ModuleDeclaration {
  private static readonly SHELL_ONLY_KINDS: readonly SettingKind[] = [SettingKind.KeyBindings, SettingKind.Languages];

  public readonly id: string;
  public readonly version: string;
  public readonly displayName: string;
  public readonly description: string;
  public readonly dependencies: readonly string[];
  public readonly dependencyVersions: ReadonlyMap<string, string>;
  public readonly runtimePackage: string | null;
  public readonly contributions: ReadonlyMap<string, readonly string[]>;
  public readonly settings: readonly SettingDefinition[];
  public readonly cliPackage: string | null;
  public readonly cliCommands: readonly JsonValue[];
  public readonly webViews: WebViewDeclaration | null;
  public readonly usesPseudoTerminals: boolean;
  public readonly optionalDependencies: readonly string[];
  public readonly optionalDependencyVersions: ReadonlyMap<string, string>;
  public readonly switchSetting: string | null;
  public readonly platforms: readonly string[] | null;
  public readonly noldovaDesktop: string | null;
  private readonly noldovaDesktopBounds: readonly [string, string] | null;

  public constructor(
    id: string,
    version: string,
    displayName: string,
    description: string,
    dependencies: ReadonlyMap<string, string>,
    runtimePackage: string | null,
    contributions: ReadonlyMap<string, readonly string[]>,
    settings: readonly SettingDefinition[] = [],
    cliPackage: string | null = null,
    cliCommands: readonly JsonValue[] = [],
    webViews: WebViewDeclaration | null = null,
    usesPseudoTerminals: boolean = false,
    optionalDependencies: ReadonlyMap<string, string> = new Map(),
    switchSetting: string | null = null,
    platforms: readonly string[] | null = null,
    noldovaDesktop: string | null = null) {
    if (!Resources.moduleIdPattern.test(id) || id === Resources.reservedModuleId)
      throw new ArgumentException(Resources.moduleIdInvalid, Resources.idParameterName);
    if (WindowsDeviceNames.includes(id))
      throw new ArgumentException(Resources.formatModuleIdDevice(id), Resources.idParameterName);
    if (!Resources.moduleVersionPattern.test(version))
      throw new ArgumentException(Resources.moduleVersionInvalid, Resources.versionParameterName);
    if ([...dependencies.values(), ...optionalDependencies.values()].some(t => !Resources.moduleVersionPattern.test(t)))
      throw new ArgumentException(Resources.dependencyVersionInvalid, Resources.dependenciesParameterName);
    ArgumentException.throwIfNullOrWhitespace(displayName, Resources.displayNameParameterName);
    ArgumentException.throwIfNullOrWhitespace(description, Resources.descriptionParameterName);
    const foreign = settings.find(t => t.name.owner !== id);
    if (!Object.isUndefined(foreign))
      throw new ArgumentException(Resources.formatSettingOwnerInvalid(id, foreign.name.text), Resources.settingsField);
    const shellOnly = settings.find(t => ModuleDeclaration.SHELL_ONLY_KINDS.includes(t.type.kind));
    if (!Object.isUndefined(shellOnly))
      throw new ArgumentException(Resources.formatSettingKindReserved(id, shellOnly.name.text, shellOnly.type.kind), Resources.settingsField);
    const shellPage = settings.find(t => Resources.shellSettingsPages.includes(t.page));
    if (!Object.isUndefined(shellPage))
      throw new ArgumentException(Resources.formatSettingPageReserved(id, shellPage.name.text, shellPage.page), Resources.settingsField);
    const commands = contributions.get(Resources.commandsKind) ?? [];
    const action = settings.find(t => t.type.kind === SettingKind.Action && !commands.includes(String(t.type.command)));
    if (!Object.isUndefined(action))
      throw new ArgumentException(Resources.formatSettingCommandUnknown(id, action.name.text, String(action.type.command)), Resources.settingsField);
    const switchDefinition = settings.find(t => t.name.text === switchSetting);
    if (!Object.isNull(switchSetting) &&
      (Object.isUndefined(switchDefinition) || switchDefinition.type.kind !== SettingKind.Boolean || switchDefinition.locality !== SettingLocality.Shared || switchDefinition.scopes.length > 0))
      throw new ArgumentException(Resources.formatSwitchSettingInvalid(id, switchSetting), Resources.switchSettingField);
    const names = [...Resources.platformDisplayNames.keys()];
    if (!Object.isNull(platforms) && (platforms.length === 0 || new Set(platforms).size < platforms.length || platforms.some(t => !names.includes(t))))
      throw new ArgumentException(Resources.formatPlatformsInvalid(id), Resources.platformsField);
    const range = Object.isNull(noldovaDesktop) ? null : Resources.noldovaDesktopRangePattern.exec(noldovaDesktop);
    if (!Object.isNull(noldovaDesktop) && (Object.isNull(range) || ModuleDeclaration.compare(String(range[1]), String(range[2])) >= 0))
      throw new ArgumentException(Resources.formatNoldovaDesktopInvalid(id), Resources.noldovaDesktopField);

    this.id = id;
    this.version = version;
    this.displayName = displayName;
    this.description = description;
    this.dependencies = [...dependencies.keys()];
    this.dependencyVersions = new Map(dependencies);
    this.runtimePackage = runtimePackage;
    this.contributions = new Map([...contributions].map(([kind, names]) => [kind, [...names]]));
    this.settings = [...settings];
    this.cliPackage = cliPackage;
    this.cliCommands = [...cliCommands];
    this.webViews = webViews;
    this.usesPseudoTerminals = usesPseudoTerminals;
    this.optionalDependencies = [...optionalDependencies.keys()];
    this.optionalDependencyVersions = new Map(optionalDependencies);
    this.switchSetting = switchSetting;
    this.platforms = Object.isNull(platforms) ? null : [...platforms];
    this.noldovaDesktop = noldovaDesktop;
    this.noldovaDesktopBounds = Object.isNull(range) ? null : [String(range[1]), String(range[2])];
  }

  public static fromJson(value: unknown): ModuleDeclaration {
    const fields = ModuleDeclaration.readObject(value);
    const id = ModuleDeclaration.read(Resources.idParameterName, t => fields.readNonBlankString(t));
    if (!Resources.moduleIdPattern.test(id) || id === Resources.reservedModuleId)
      throw new DeclarationFieldInvalidException(Resources.idParameterName);
    if (WindowsDeviceNames.includes(id))
      throw new ModuleIdDeviceException(id);
    const version = ModuleDeclaration.read(Resources.versionParameterName, t => fields.readNonBlankString(t));
    if (!Resources.moduleVersionPattern.test(version))
      throw new DeclarationFieldInvalidException(Resources.versionParameterName);

    const contributes = ModuleDeclaration.read(Resources.contributesParameterName, t => fields.readObject(t));
    const displayName = ModuleDeclaration.read(Resources.displayNameParameterName, t => fields.readNonBlankString(t));
    const description = ModuleDeclaration.read(Resources.descriptionParameterName, t => fields.readNonBlankString(t));
    const dependencies = ModuleDeclaration.read(Resources.dependenciesParameterName, t => ModuleDeclaration.readVersions(fields.readObject(t), t));
    return new ModuleDeclaration(
      id,
      version,
      displayName,
      description,
      dependencies,
      ModuleDeclaration.read(Resources.runtimePackageParameterName, t => ModuleDeclaration.readNullableText(fields, t)),
      ModuleDeclaration.read(Resources.contributesParameterName, t => new Map(Object.keys(contributes.toJson()).map(u => [u, ModuleDeclaration.readNames(contributes, u, t)]))),
      ModuleDeclaration.readSettings(fields.hasField(Resources.settingsField) ? fields.readValue(Resources.settingsField) : []),
      ModuleDeclaration.read(Resources.cliPackageField, t => fields.hasField(t) ? ModuleDeclaration.readNullableText(fields, t) : null),
      ModuleDeclaration.read(Resources.cliCommandsField, t => fields.hasField(t) ? ModuleDeclaration.readValues(fields.readValue(t), t) : []),
      ModuleDeclaration.readWebViews(fields.hasField(Resources.webViewsField) ? fields.readValue(Resources.webViewsField) : null),
      ModuleDeclaration.read(Resources.pseudoTerminalsField, t => fields.hasField(t) && fields.readBoolean(t)),
      ModuleDeclaration.read(Resources.optionalDependenciesField, t => fields.hasField(t) ? ModuleDeclaration.readVersions(fields.readObject(t), t) : new Map<string, string>()),
      ModuleDeclaration.read(Resources.switchSettingField, t => fields.hasField(t) ? fields.readNonBlankString(t) : null),
      ModuleDeclaration.read(Resources.platformsField, t => fields.hasField(t) ? ModuleDeclaration.readNames(fields, t, t) : null),
      ModuleDeclaration.read(Resources.noldovaDesktopField, t => fields.hasField(t) ? fields.readNonBlankString(t) : null));
  }

  public accepts(dependency: string, version: string): boolean {
    if (!Resources.moduleVersionPattern.test(version))
      throw new ArgumentException(Resources.moduleVersionInvalid, Resources.versionParameterName);
    return (this.dependencyVersions.get(dependency) ?? this.optionalDependencyVersions.get(dependency) ?? version) === version;
  }

  public runsOn(platform: string): boolean {
    return Object.isNull(this.platforms) || this.platforms.includes(Resources.modulePlatforms.get(platform) ?? platform);
  }

  public acceptsNoldovaDesktop(version: string | null): boolean {
    if (Object.isNull(this.noldovaDesktopBounds))
      return true;
    const [minimum, below] = this.noldovaDesktopBounds;
    return !Object.isNull(version) && Resources.moduleVersionPattern.test(version) && ModuleDeclaration.compare(version, minimum) >= 0 && ModuleDeclaration.compare(version, below) < 0;
  }

  public listContributions(kind: string): readonly string[] {
    return this.contributions.get(kind) ?? [];
  }

  private static readSettings(value: unknown): readonly SettingDefinition[] {
    if (!Array.isArray(value))
      throw new DeclarationFieldInvalidException(Resources.settingsField);
    try {
      return value.map(t => SettingDefinition.fromJson(t));
    }
    catch (error) {
      throw new DeclarationFieldInvalidException(Resources.settingsField, new ExceptionOptions(error));
    }
  }

  private static readWebViews(value: unknown): WebViewDeclaration | null {
    if (Object.isNull(value))
      return null;
    try {
      return WebViewDeclaration.fromJson(value);
    }
    catch (error) {
      throw new DeclarationFieldInvalidException(Resources.webViewsField, new ExceptionOptions(error));
    }
  }

  private static compare(left: string, right: string): number {
    const first = left.split(Resources.versionSeparator);
    const second = right.split(Resources.versionSeparator);
    for (let index = 0; index < Resources.versionParts; index++) {
      const difference = Number(first[index]) - Number(second[index]);
      if (difference !== 0)
        return difference;
    }
    return 0;
  }

  private static readObject(value: unknown): JsonReader {
    try {
      return JsonReader.fromValue(value);
    }
    catch (error) {
      if (error instanceof JsonException)
        throw new DeclarationNotObjectException(new ExceptionOptions(error));
      throw error;
    }
  }

  private static read<T>(name: string, read: (name: string) => T): T {
    try {
      return read(name);
    }
    catch (error) {
      if (error instanceof JsonException)
        throw new DeclarationFieldInvalidException(name, new ExceptionOptions(error));
      throw error;
    }
  }

  private static readNullableText(fields: JsonReader, name: string): string | null {
    const text = fields.readNullableString(name);
    if (!Object.isNull(text) && String.isNullOrWhitespace(text))
      throw new DeclarationFieldInvalidException(name);
    return text;
  }

  private static readValues(value: unknown, name: string): readonly JsonValue[] {
    if (!Array.isArray(value))
      throw new DeclarationFieldInvalidException(name);
    return value.map(t => JsonReader.toJsonValue(t));
  }

  private static readVersions(fields: JsonReader, name: string): ReadonlyMap<string, string> {
    const versions = new Map<string, string>();
    for (const id of Object.keys(fields.toJson())) {
      const text = fields.readString(id);
      if (String.isNullOrWhitespace(id) || !Resources.moduleVersionPattern.test(text))
        throw new DeclarationFieldInvalidException(name);
      versions.set(id, text);
    }
    return versions;
  }

  private static readNames(fields: JsonReader, field: string, name: string): readonly string[] {
    const names = fields.readStringArray(field);
    if (names.some(t => String.isNullOrWhitespace(t)))
      throw new DeclarationFieldInvalidException(name);
    return names;
  }
}
