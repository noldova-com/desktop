/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class FileGrant {
  public static readonly maximumLifetime: number = Resources.maximumGrantLifetime;

  private static readonly FIELDS: readonly string[] = [
    Resources.grantField, Resources.pathField, Resources.nameField, Resources.mediaTypeField, Resources.sizeField, Resources.identityField,
    Resources.moduleField, Resources.windowField, Resources.pageField, Resources.lifetimeField, Resources.stagedField
  ];

  public readonly grant: string;
  public readonly path: string;
  public readonly name: string;
  public readonly mediaType: string;
  public readonly size: number;
  public readonly identity: string;
  public readonly module: string;
  public readonly window: number;
  public readonly page: number;
  public readonly lifetime: number;
  public readonly isStaged: boolean;

  public constructor(grant: string, path: string, name: string, mediaType: string, size: number, identity: string, module: string, window: number, page: number,
    lifetime: number, isStaged: boolean) {
    if (!Resources.grantPattern.test(grant))
      throw new ArgumentException(Resources.grantInvalid, Resources.grantField);
    const blank = ([[path, Resources.pathField], [name, Resources.nameField], [mediaType, Resources.mediaTypeField], [identity, Resources.identityField]] as const)
      .find(t => String.isNullOrWhitespace(t[0]));
    if (!Object.isUndefined(blank))
      throw new ArgumentException(Resources.grantPathInvalid, blank[1]);
    if (!Number.isSafeInteger(size) || size < 0)
      throw new ArgumentOutOfRangeException(Resources.sizeField, size, Resources.grantSizeInvalid);
    if (!Resources.ownerPattern.test(module) || module === Resources.shellOwner)
      throw new ArgumentException(Resources.grantModuleInvalid, Resources.moduleField);
    if (!Number.isInteger(window) || window <= 0)
      throw new ArgumentOutOfRangeException(Resources.windowField, window, Resources.windowInvalid);
    if (!Number.isInteger(page) || page <= 0)
      throw new ArgumentOutOfRangeException(Resources.pageField, page, Resources.pageInvalid);
    if (!Number.isInteger(lifetime) || lifetime <= 0 || lifetime > FileGrant.maximumLifetime)
      throw new ArgumentOutOfRangeException(Resources.lifetimeField, lifetime, Resources.grantLifetimeInvalid);

    this.grant = grant;
    this.path = path;
    this.name = name;
    this.mediaType = mediaType;
    this.size = size;
    this.identity = identity;
    this.module = module;
    this.window = window;
    this.page = page;
    this.lifetime = lifetime;
    this.isStaged = isStaged;
  }

  public static fromJson(value: unknown, path?: string): FileGrant {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, FileGrant.FIELDS);
    return WireContract.create(reader, () => new FileGrant(
      reader.readString(Resources.grantField),
      reader.readString(Resources.pathField),
      reader.readString(Resources.nameField),
      reader.readString(Resources.mediaTypeField),
      reader.readInteger(Resources.sizeField),
      reader.readString(Resources.identityField),
      reader.readString(Resources.moduleField),
      reader.readInteger(Resources.windowField),
      reader.readInteger(Resources.pageField),
      reader.readInteger(Resources.lifetimeField),
      reader.readBoolean(Resources.stagedField)));
  }

  public toJson(): JsonObject {
    return {
      [Resources.grantField]: this.grant,
      [Resources.pathField]: this.path,
      [Resources.nameField]: this.name,
      [Resources.mediaTypeField]: this.mediaType,
      [Resources.sizeField]: this.size,
      [Resources.identityField]: this.identity,
      [Resources.moduleField]: this.module,
      [Resources.windowField]: this.window,
      [Resources.pageField]: this.page,
      [Resources.lifetimeField]: this.lifetime,
      [Resources.stagedField]: this.isStaged
    };
  }
}
