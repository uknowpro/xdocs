import test from "node:test";
import assert from "node:assert/strict";
import { backupDrawing, drawingSVG } from "../shared/aws-drawing.mjs";
import {
  newArchitecture,
  encodeArchitecture,
  decodeArchitecture,
  generateArchitecture,
} from "../shared/architecture.mjs";
test("drawing-only account plans preserve their diagram and stay outside generated resources", () => {
  const model = { ...newArchitecture(), drawing: backupDrawing() };
  model.drawing.organization = "Org <diagram>";
  const saved = decodeArchitecture(encodeArchitecture(model));
  assert.deepEqual(saved.drawing, model.drawing);
  const result = generateArchitecture(saved);
  assert.deepEqual(result.errors, []);
  assert.equal(result.files["aws-drawing.svg"], drawingSVG(model.drawing));
  assert.match(result.files["aws-drawing.svg"], /Org &lt;diagram&gt;/);
  assert.ok(
    !Object.keys(result.files).some((name) => name.startsWith("terraform/")),
  );
  model.drawing.arrows[0].from = "missing";
  assert.throws(() => encodeArchitecture(model), /연결/);
});
