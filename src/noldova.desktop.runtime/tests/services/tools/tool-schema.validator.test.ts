/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ToolSchemaValidator } from "@noldova/desktop.runtime";

@TestClass
export class ToolSchemaValidatorTests {
  private static readonly DIALECT: string = "https://json-schema.org/draft/2020-12/schema";

  @TestMethod
  public acceptsASchemaThatUsesEveryKeywordOfTheSubset(): void {
    const validator = new ToolSchemaValidator();
    const schema: JsonObject = {
      type: "object",
      $schema: ToolSchemaValidatorTests.DIALECT,
      $comment: "Notes.",
      title: "Search",
      description: "Searches the notes.",
      default: {},
      examples: [{ query: "plans" }],
      deprecated: false,
      readOnly: false,
      writeOnly: false,
      properties: {
        query: { type: ["string", "null"], enum: ["a", null], const: "a", minLength: 0, maxLength: 2, pattern: "^a$" },
        count: { type: "number", minimum: 0, maximum: 1, exclusiveMinimum: -1, exclusiveMaximum: 2 },
        ids: { type: "array", items: { type: "integer" }, minItems: 0, maxItems: 3 },
        tags: { type: "object", required: ["a"], additionalProperties: { type: "string" } },
        either: { anyOf: [{ type: "string" }, { type: "boolean" }] },
        closed: { additionalProperties: false }
      },
      required: ["query"],
      additionalProperties: false
    };

    validator.checkSchema(schema, "inputSchema");

    Assert.isNull(validator.findProblem(schema, { query: "a" }));
  }

  @TestMethod
  public refusesASchemaWhoseTypeIsNotObject(): void {
    const schemas: readonly JsonObject[] = [{}, { type: "string" }, { type: ["object"] }];

    const messages = schemas.map(t => ToolSchemaValidatorTests.refuse(t));

    for (const message of messages)
      Assert.areEqual("A tool's schema must be a JSON Schema object whose type is object.", message);
  }

  @TestMethod
  public refusesAKeywordOutsideTheSubsetOrAValueItCannotTake(): void {
    const unsupported = (path: string): string => `The schema keyword at ${path} is not one the tool registry checks.`;
    const invalid = (path: string): string => `The schema keyword at ${path} has a value the tool registry cannot use.`;
    const notObject = (path: string): string => `The schema at ${path} must be a JSON object.`;
    const nested = (schema: JsonObject): JsonObject => ({ properties: { v: schema } });
    const cases: readonly (readonly [JsonObject, string])[] = [
      [{ $schema: "http://json-schema.org/draft-07/schema#" }, invalid("/$schema")],
      [{ $comment: 1 }, invalid("/$comment")],
      [{ title: 1 }, invalid("/title")],
      [{ description: null }, invalid("/description")],
      [{ examples: {} }, invalid("/examples")],
      [{ deprecated: "no" }, invalid("/deprecated")],
      [{ readOnly: 1 }, invalid("/readOnly")],
      [{ writeOnly: null }, invalid("/writeOnly")],
      [{ required: ["a", "a"] }, invalid("/required")],
      [{ required: [1] }, invalid("/required")],
      [{ required: "a" }, invalid("/required")],
      [{ additionalProperties: 1 }, notObject("/additionalProperties")],
      [{ additionalProperties: { oneOf: [] } }, unsupported("/additionalProperties/oneOf")],
      [{ properties: [] }, invalid("/properties")],
      [{ properties: { query: true } }, notObject("/properties/query")],
      [{ "a~/b": 1 }, unsupported("/a~0~1b")],
      [nested({ type: "date" }), invalid("/properties/v/type")],
      [nested({ type: [] }), invalid("/properties/v/type")],
      [nested({ type: ["string", "string"] }), invalid("/properties/v/type")],
      [nested({ type: [1] }), invalid("/properties/v/type")],
      [nested({ enum: [] }), invalid("/properties/v/enum")],
      [nested({ enum: "a" }), invalid("/properties/v/enum")],
      [nested({ minLength: -1 }), invalid("/properties/v/minLength")],
      [nested({ maxLength: 1.5 }), invalid("/properties/v/maxLength")],
      [nested({ minItems: "1" }), invalid("/properties/v/minItems")],
      [nested({ maxItems: -1 }), invalid("/properties/v/maxItems")],
      [nested({ pattern: "(" }), invalid("/properties/v/pattern")],
      [nested({ pattern: 1 }), invalid("/properties/v/pattern")],
      [nested({ minimum: "1" }), invalid("/properties/v/minimum")],
      [nested({ maximum: null }), invalid("/properties/v/maximum")],
      [nested({ exclusiveMinimum: "0" }), invalid("/properties/v/exclusiveMinimum")],
      [nested({ exclusiveMaximum: [] }), invalid("/properties/v/exclusiveMaximum")],
      [nested({ items: true }), notObject("/properties/v/items")],
      [nested({ items: { format: "date" } }), unsupported("/properties/v/items/format")],
      [nested({ anyOf: [] }), invalid("/properties/v/anyOf")],
      [nested({ anyOf: {} }), invalid("/properties/v/anyOf")],
      [nested({ anyOf: [{}, 1] }), notObject("/properties/v/anyOf/1")],
      [nested({ $ref: "#" }), unsupported("/properties/v/$ref")],
      [nested({ format: "uri" }), unsupported("/properties/v/format")]
    ];

    const messages = cases.map(([schema]) => ToolSchemaValidatorTests.refuse({ type: "object", ...schema }));

    Assert.areEqual(cases.map(([, message]) => message).join("\n"), messages.join("\n"));
  }

  @TestMethod
  public findsTheFirstValueThatDoesNotFitByItsPointerAndKeyword(): void {
    const fit = (keyword: string, path: string = "/v"): string => `The value at ${path} does not fit the schema's ${keyword}.`;
    const cases: readonly (readonly [JsonObject, JsonValue, string | null])[] = [
      [{ type: "string" }, 1, fit("type")],
      [{ type: "string" }, "a", null],
      [{ type: ["integer", "null"] }, null, null],
      [{ type: ["integer", "null"] }, 1.5, fit("type")],
      [{ type: "boolean" }, true, null],
      [{ type: "object" }, {}, null],
      [{ type: "object" }, [], fit("type")],
      [{ type: "array" }, [], null],
      [{ type: "number" }, 1.5, null],
      [{ type: "date" }, "a", fit("type")],
      [{ type: [1] }, "a", fit("type")],
      [{ enum: ["a", 1, null, [1, { x: 2 }], { y: [3] }] }, "a", null],
      [{ enum: ["a", 1, null, [1, { x: 2 }], { y: [3] }] }, [1, { x: 2 }], null],
      [{ enum: ["a", 1, null, [1, { x: 2 }], { y: [3] }] }, { y: [3] }, null],
      [{ enum: ["a", 1, null, [1, { x: 2 }], { y: [3] }] }, "b", fit("enum")],
      [{ enum: [[1, { x: 2 }]] }, [1], fit("enum")],
      [{ enum: [[1, { x: 2 }]] }, [1, { x: 3 }], fit("enum")],
      [{ enum: [{ y: [3] }] }, { y: [3], z: 1 }, fit("enum")],
      [{ enum: [{ y: [3] }] }, { y: [4] }, fit("enum")],
      [{ enum: [{ y: [3] }] }, { z: [3] }, fit("enum")],
      [{ const: { a: 1 } }, { a: 1 }, null],
      [{ const: { a: 1 } }, { a: 2 }, fit("const")],
      [{ anyOf: [{ type: "string" }, { type: "integer" }] }, 1, null],
      [{ anyOf: [{ type: "string" }, { type: "integer" }] }, true, fit("anyOf")],
      [{ anyOf: [true] }, 1, fit("anyOf")],
      [{ minLength: 2 }, "é", fit("minLength")],
      [{ maxLength: 1 }, "ab", fit("maxLength")],
      [{ maxLength: 1 }, "😀", null],
      [{ minLength: 1, maxLength: 3, pattern: "b" }, "abc", null],
      [{ pattern: "^a+$" }, "ab", fit("pattern")],
      [{ pattern: "(" }, "a", fit("pattern")],
      [{ minimum: 1 }, 0, fit("minimum")],
      [{ maximum: 1 }, 2, fit("maximum")],
      [{ exclusiveMinimum: 1 }, 1, fit("exclusiveMinimum")],
      [{ exclusiveMaximum: 1 }, 1, fit("exclusiveMaximum")],
      [{ minimum: 0, maximum: 2, exclusiveMinimum: -1, exclusiveMaximum: 3 }, 1, null],
      [{ minItems: 1 }, [], fit("minItems")],
      [{ maxItems: 1 }, [1, 2], fit("maxItems")],
      [{ items: { type: "string" } }, ["a", 1], fit("type", "/v/1")],
      [{ items: { type: "string" } }, ["a"], null],
      [{}, [1], null],
      [{ required: ["a"] }, {}, fit("required")],
      [{ required: ["a"] }, { a: 1 }, null],
      [{ required: [1] }, {}, null],
      [{ properties: { a: {} }, additionalProperties: false }, { a: 1, b: 2 }, fit("additionalProperties")],
      [{ additionalProperties: false }, {}, null],
      [{ additionalProperties: false }, { b: 1 }, fit("additionalProperties")],
      [{ properties: { a: { type: "string" } } }, { a: 1 }, fit("type", "/v/a")],
      [{ properties: { "a/b~": { type: "string" } } }, { "a/b~": 1 }, fit("type", "/v/a~1b~0")],
      [{ additionalProperties: { type: "string" } }, { b: 1 }, fit("type", "/v/b")],
      [{ properties: { a: {} } }, { c: 1 }, null],
      [{}, true, null],
      [{}, null, null]
    ];
    const validator = new ToolSchemaValidator();

    const problems = cases.map(([schema, value]) => validator.findProblem({ properties: { v: schema } }, { v: value }));

    Assert.areEqual(cases.map(([, , problem]) => String(problem)).join("\n"), problems.map(t => String(t)).join("\n"));
  }

  @TestMethod
  public namesNoPointerForTheValueAtTheRootAndReusesACompiledPattern(): void {
    const validator = new ToolSchemaValidator();
    const schema: JsonObject = { type: "object", required: ["query"], properties: { query: { type: "string", pattern: "^[a-z]+$" } } };
    validator.checkSchema(schema, "inputSchema");

    const missing = validator.findProblem(schema, {});
    const fits = validator.findProblem(schema, { query: "plans" });
    const unfit = validator.findProblem(schema, { query: "Plans" });

    Assert.areEqual("The value does not fit the schema's required.", missing);
    Assert.isNull(fits);
    Assert.areEqual("The value at /query does not fit the schema's pattern.", unfit);
  }

  private static refuse(schema: JsonObject): string {
    const exception = Assert.throws(() => new ToolSchemaValidator().checkSchema(schema, "outputSchema"), ArgumentException);
    Assert.areEqual("outputSchema", exception.parameterName);
    return exception.message.split(" (Parameter")[0] ?? exception.message;
  }
}
