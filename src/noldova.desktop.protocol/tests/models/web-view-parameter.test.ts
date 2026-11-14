/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WebViewParameter } from "@noldova/desktop.protocol";

@TestClass
export class WebViewParameterTests {
  @TestMethod
  public pinsItsWireFormWithOnlyWhatItGives(): void {
    const full = "{\"required\":true,\"fields\":{\"width\":{\"minimum\":1,\"maximum\":4096},\"format\":{\"values\":[\"png\",\"jpeg\"]},\"label\":{\"maxLength\":64},\"any\":{}}}";

    Assert.areEqual(full, JSON.stringify(WebViewParameter.fromJson(JsonReader.parse(full).toJson()).toJson()));
    Assert.areEqual("{}", JSON.stringify(new WebViewParameter().toJson()));
    Assert.areEqual("{\"maximum\":10}", JSON.stringify(WebViewParameter.fromJson({ required: false, maximum: 10 }).toJson()));
  }

  @TestMethod
  public allowsOnlyAValueItsRuleHolds(): void {
    const values = new WebViewParameter(false, ["png", 2, false]);
    const range = new WebViewParameter(false, null, 0, 100);
    const below = new WebViewParameter(false, null, null, 10);
    const above = new WebViewParameter(false, null, 5);
    const text = new WebViewParameter(false, null, null, null, 3);

    Assert.areEqual("true,true,true,false,false,false", ["png", 2, false, "PNG", "2", 0].map(t => values.allows(t)).join(","));
    Assert.areEqual("true,true,true,false,false,false,false", [0, 55.5, 100, -1, 101, "50", Number.NaN].map(t => range.allows(t)).join(","));
    Assert.areEqual("true,true,false", [-1e9, 10, 10.5].map(t => below.allows(t)).join(","));
    Assert.areEqual("true,true,false", [5, 1e9, 4.5].map(t => above.allows(t)).join(","));
    Assert.areEqual("true,true,false,false", [String.empty, "abc", "abcd", 3].map(t => text.allows(t)).join(","));
    Assert.areEqual("true,true,true", [null, { deep: [1] }, "x"].map(t => new WebViewParameter().allows(t)).join(","));
  }

  @TestMethod
  public allowsAnObjectOfOnlyItsFieldsWithEveryRequiredOne(): void {
    const clip = WebViewParameter.fromJson({ fields: { width: { required: true, maximum: 4096 }, scale: { maximum: 1 } } });

    Assert.isTrue(clip.allows({ width: 4096 }));
    Assert.isTrue(clip.allows({ width: 10, scale: 0.5 }));
    Assert.isFalse(clip.allows({ scale: 0.5 }));
    Assert.isFalse(clip.allows({ width: 4097 }));
    Assert.isFalse(clip.allows({ width: 10, height: 10 }));
    Assert.isFalse(clip.allows([10]));
    Assert.isFalse(clip.allows(null));
    Assert.isFalse(WebViewParameter.allowsFields(new Map(), { ["__proto__"]: 1 }));
    Assert.isTrue(WebViewParameter.allowsFields(new Map(), {}));
  }

  @TestMethod
  public refusesARuleThatIsInvalid(): void {
    Assert.areEqual("values", Assert.throws(() => new WebViewParameter(false, ["a"], 0, 1), ArgumentException).parameterName);
    Assert.areEqual("values", Assert.throws(() => new WebViewParameter(false, []), ArgumentException).parameterName);
    Assert.areEqual("values", Assert.throws(() => new WebViewParameter(false, ["a", "a"]), ArgumentException).parameterName);
    Assert.areEqual("minimum", Assert.throws(() => new WebViewParameter(false, null, 2, 1), ArgumentException).parameterName);
    Assert.areEqual("maximum", Assert.throws(() => new WebViewParameter(false, null, null, Infinity), ArgumentException).parameterName);
    Assert.areEqual("maxLength", Assert.throws(() => new WebViewParameter(false, null, null, null, 0), ArgumentException).parameterName);
    Assert.areEqual("fields.Width", Assert.throws(() => new WebViewParameter(false, null, null, null, null, new Map([["Width", new WebViewParameter()]])), ArgumentException).parameterName);
  }

  @TestMethod
  public namesThePathThatIsInvalid(): void {
    Assert.areEqual("$.maximun", Assert.throws(() => WebViewParameter.fromJson({ maximun: 10 }), JsonException).path);
    Assert.areEqual("$.values", Assert.throws(() => WebViewParameter.fromJson({ values: [{}] }), JsonException).path);
    Assert.areEqual("$.values", Assert.throws(() => WebViewParameter.fromJson({ values: "png" }), JsonException).path);
    Assert.areEqual("$.minimum", Assert.throws(() => WebViewParameter.fromJson({ minimum: 5, maximum: 1 }), JsonException).path);
    Assert.areEqual("$.fields.clip.fields.x.maximum", Assert.throws(() => WebViewParameter.fromJson({ fields: { clip: { fields: { x: { maximum: "1" } } } } }), JsonException).path);
    Assert.areEqual("$.fields.no-dash", Assert.throws(() => WebViewParameter.fromJson({ fields: { "no-dash": {} } }), JsonException).path);
    Assert.areEqual("$.width.size", Assert.throws(() => WebViewParameter.readFields(JsonReader.fromValue({ width: { size: 1 } })), JsonException).path);
  }
}
