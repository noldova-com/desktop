/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonException, JsonReader } from "@noldova/context.json";

import { UpdateStateKind } from "../enums/update-state-kind.js";
import { ProductName } from "./product-name.js";
import { Resources } from "../../resources.js";

export class UpdateState {
  public static readonly off: UpdateState = new UpdateState(UpdateStateKind.Off, null, null, null, null, false);

  public readonly kind: UpdateStateKind;
  public readonly version: string | null;
  public readonly progress: number | null;
  public readonly checkedAt: number | null;
  public readonly reason: string | null;
  public readonly mustMove: boolean;

  public constructor(kind: UpdateStateKind, version: string | null, progress: number | null, checkedAt: number | null, reason: string | null, mustMove: boolean) {
    this.kind = kind;
    this.version = version;
    this.progress = progress;
    this.checkedAt = checkedAt;
    this.reason = reason;
    this.mustMove = mustMove;
  }

  public static fromJson(value: unknown): UpdateState {
    const json = JsonReader.fromValue(value);
    const kind = json.readString(Resources.kindField);
    const known = Object.values(UpdateStateKind).find(t => t === kind);
    if (Object.isUndefined(known))
      throw new JsonException(Resources.unknownUpdateState, Resources.formatJsonPath(json.path, Resources.kindField));
    const progress = json.readNullableInteger(Resources.progressField);
    if (!Object.isNull(progress) && (progress < 0 || progress > Resources.maximumProgress))
      throw new JsonException(Resources.invalidUpdateProgress, Resources.formatJsonPath(json.path, Resources.progressField));
    const version = json.readNullableString(Resources.versionField);
    if (Object.isNull(version) && [UpdateStateKind.Available, UpdateStateKind.Downloading, UpdateStateKind.Ready].includes(known))
      throw new JsonException(Resources.missingUpdateVersion, Resources.formatJsonPath(json.path, Resources.versionField));
    const mustMove = json.readBoolean(Resources.mustMoveField);
    if (mustMove !== (known === UpdateStateKind.Available) && known !== UpdateStateKind.Failed)
      throw new JsonException(Resources.formatInvalidUpdateMove(ProductName.current), Resources.formatJsonPath(json.path, Resources.mustMoveField));
    return new UpdateState(known, version, progress, json.readNullableInteger(Resources.checkedAtField), json.readNullableString(Resources.reasonField), mustMove);
  }

  public get canCheck(): boolean {
    return [UpdateStateKind.UpToDate, UpdateStateKind.Available, UpdateStateKind.Failed].includes(this.kind);
  }

  public get canRestart(): boolean {
    return this.kind === UpdateStateKind.Ready;
  }

  public get showsItem(): boolean {
    return [UpdateStateKind.Available, UpdateStateKind.Ready, UpdateStateKind.Failed].includes(this.kind);
  }
}
