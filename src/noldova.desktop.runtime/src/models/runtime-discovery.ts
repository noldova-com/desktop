/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException, ExceptionOptions } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";

import { DiscoveryFieldInvalidException } from "../exceptions/discovery-field-invalid.exception.js";
import { DiscoveryNotObjectException } from "../exceptions/discovery-not-object.exception.js";
import { DiscoveryVersionUnsupportedException } from "../exceptions/discovery-version-unsupported.exception.js";
import type { IRuntimeDiscoveryJson } from "../interfaces/i-runtime-discovery-json.js";
import { Resources } from "../resources.js";

export class RuntimeDiscovery {
  public readonly endpoint: string;
  public readonly token: string;
  public readonly processId: number;
  public readonly executablePath: string;
  public readonly productVersion: string;
  public readonly protocolVersion: number;
  public readonly build: string;

  public constructor(
    endpoint: string,
    token: string,
    processId: number,
    executablePath: string,
    productVersion: string,
    protocolVersion: number,
    build: string) {
    ArgumentException.throwIfNullOrWhitespace(endpoint, Resources.endpointParameterName);
    ArgumentException.throwIfNullOrWhitespace(token, Resources.tokenParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(processId, Resources.processIdParameterName);
    ArgumentException.throwIfNullOrWhitespace(executablePath, Resources.executablePathParameterName);
    ArgumentException.throwIfNullOrWhitespace(productVersion, Resources.productVersionParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(protocolVersion, Resources.protocolVersionParameterName);
    ArgumentException.throwIfNullOrWhitespace(build, Resources.buildParameterName);

    this.endpoint = endpoint;
    this.token = token;
    this.processId = processId;
    this.executablePath = executablePath;
    this.productVersion = productVersion;
    this.protocolVersion = protocolVersion;
    this.build = build;
  }

  public static fromJson(value: unknown): RuntimeDiscovery {
    const fields = RuntimeDiscovery.readObject(value);
    const formatVersion = fields.hasField(Resources.formatVersionField) ? fields.readValue(Resources.formatVersionField) : undefined;
    if (formatVersion !== Resources.discoveryFormatVersion)
      throw new DiscoveryVersionUnsupportedException(formatVersion);

    return new RuntimeDiscovery(
      RuntimeDiscovery.readField(Resources.endpointParameterName, t => fields.readNonBlankString(t)),
      RuntimeDiscovery.readField(Resources.tokenParameterName, t => fields.readNonBlankString(t)),
      RuntimeDiscovery.readField(Resources.processIdParameterName, t => RuntimeDiscovery.readCount(fields, t)),
      RuntimeDiscovery.readField(Resources.executablePathParameterName, t => fields.readNonBlankString(t)),
      RuntimeDiscovery.readField(Resources.productVersionParameterName, t => fields.readNonBlankString(t)),
      RuntimeDiscovery.readField(Resources.protocolVersionParameterName, t => RuntimeDiscovery.readCount(fields, t)),
      RuntimeDiscovery.readField(Resources.buildParameterName, t => fields.readNonBlankString(t)));
  }

  public toJson(): IRuntimeDiscoveryJson {
    return {
      formatVersion: Resources.discoveryFormatVersion,
      endpoint: this.endpoint,
      token: this.token,
      processId: this.processId,
      executablePath: this.executablePath,
      productVersion: this.productVersion,
      protocolVersion: this.protocolVersion,
      build: this.build
    };
  }

  private static readObject(value: unknown): JsonReader {
    try {
      return JsonReader.fromValue(value);
    }
    catch (error) {
      if (error instanceof JsonException)
        throw new DiscoveryNotObjectException(new ExceptionOptions(error));
      throw error;
    }
  }

  private static readField<T>(name: string, read: (name: string) => T): T {
    try {
      return read(name);
    }
    catch (error) {
      if (error instanceof JsonException)
        throw new DiscoveryFieldInvalidException(name, new ExceptionOptions(error));
      throw error;
    }
  }

  private static readCount(fields: JsonReader, name: string): number {
    const count = fields.readInteger(name);
    if (!Number.isSafeInteger(count) || count < 1)
      throw new DiscoveryFieldInvalidException(name);
    return count;
  }
}
