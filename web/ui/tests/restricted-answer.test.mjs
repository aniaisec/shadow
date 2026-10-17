import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const bundled = await build({
  entryPoints: ["src/AnswerView.tsx"], bundle: true, write: false,
  platform: "node", format: "cjs", packages: "external",
});
const compiled = { exports: {} };
runInNewContext(bundled.outputFiles[0].text, {
  module: compiled, exports: compiled.exports, require: createRequire(import.meta.url),
});
const { AnswerView } = compiled.exports;
const note = "Your Box access does not include this Restricted folder.";
const base = { answer_markdown: note, restricted_note: note,
  citations: [], decision_status: null, who_to_ask: null };
const render = (answer) => renderToStaticMarkup(React.createElement(AnswerView, {
  question: "What is the vendor pricing?", answer,
  followups: ["Tell me more"], onAsk() {},
}));

test("full refusal appears once in the left conversation without preview or follow-ups", () => {
  const html = render(base);
  assert.match(html, /class="conversation"/);
  assert.match(html, /class="restricted" role="status"/);
  assert.match(html, /I can&#x27;t use that source for you/);
  assert.equal(html.split(note).length - 1, 1);
  assert.doesNotMatch(html, /class="preview"|class="followups"|Shadow is thinking/);
});

test("partial answer keeps readable sources, preview and withheld-source message", () => {
  const html = render({ ...base, answer_markdown: "Public answer",
    citations: [{ file_id: "public", name: "Checkout", source_type: "issue",
      date: "2026-10-17", box_url: "https://app.box.com/file/public" }] });
  assert.match(html, /Public answer/);
  assert.match(html, /One source was withheld/);
  assert.match(html, /class="preview"/);
  assert.match(html, /class="followups"/);
});

test("ordinary answers keep their follow-ups", () => {
  const html = render({ ...base, answer_markdown: "Answer", restricted_note: null });
  assert.match(html, /class="answer-md"/);
  assert.match(html, /class="followups"/);
  assert.doesNotMatch(html, /class="restricted"/);
});
