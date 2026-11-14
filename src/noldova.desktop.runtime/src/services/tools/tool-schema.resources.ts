/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ToolSchemaResources {
  public static readonly dialect: string = "https://json-schema.org/draft/2020-12/schema";
  public static readonly patternFlags: string = "u";
  public static readonly nullType: string = "null";
  public static readonly booleanType: string = "boolean";
  public static readonly objectType: string = "object";
  public static readonly arrayType: string = "array";
  public static readonly numberType: string = "number";
  public static readonly integerType: string = "integer";
  public static readonly stringType: string = "string";
  public static readonly schemaKeyword: string = "$schema";
  public static readonly commentKeyword: string = "$comment";
  public static readonly titleKeyword: string = "title";
  public static readonly descriptionKeyword: string = "description";
  public static readonly defaultKeyword: string = "default";
  public static readonly examplesKeyword: string = "examples";
  public static readonly deprecatedKeyword: string = "deprecated";
  public static readonly readOnlyKeyword: string = "readOnly";
  public static readonly writeOnlyKeyword: string = "writeOnly";
  public static readonly typeKeyword: string = "type";
  public static readonly enumKeyword: string = "enum";
  public static readonly constKeyword: string = "const";
  public static readonly minLengthKeyword: string = "minLength";
  public static readonly maxLengthKeyword: string = "maxLength";
  public static readonly patternKeyword: string = "pattern";
  public static readonly minimumKeyword: string = "minimum";
  public static readonly maximumKeyword: string = "maximum";
  public static readonly exclusiveMinimumKeyword: string = "exclusiveMinimum";
  public static readonly exclusiveMaximumKeyword: string = "exclusiveMaximum";
  public static readonly minItemsKeyword: string = "minItems";
  public static readonly maxItemsKeyword: string = "maxItems";
  public static readonly itemsKeyword: string = "items";
  public static readonly propertiesKeyword: string = "properties";
  public static readonly requiredKeyword: string = "required";
  public static readonly additionalPropertiesKeyword: string = "additionalProperties";
  public static readonly anyOfKeyword: string = "anyOf";
}
