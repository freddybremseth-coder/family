import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");

test("FamilyHub public page has one clear search identity", () => {
  assert.equal((html.match(/<title\b/gi) || []).length, 1);
  assert.equal((html.match(/<h1\b/gi) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/gi) || []).length, 1);
  assert.match(html, /https:\/\/family\.chatgenius\.pro\//);
  assert.match(html, /application\/ld\+json/);
});

test("FamilyHub connects product, ChatGenius and Freddy Bremseth entities", () => {
  assert.match(html, /https:\/\/www\.chatgenius\.pro\/#organization/);
  assert.match(html, /https:\/\/www\.freddybremseth\.com\/#person/);
  assert.match(html, /https:\/\/www\.chatgenius\.pro\/case\/familyhub\//);
  assert.match(html, /https:\/\/www\.freddybremseth\.com\//);
});

test("public metrics are explicitly labeled synthetic demo data", () => {
  assert.match(html, /Eksempeltall · syntetiske demo-data/);
});
