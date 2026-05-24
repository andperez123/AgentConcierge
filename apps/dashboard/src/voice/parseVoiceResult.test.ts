import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatMockVoiceReply,
  isAllowedVoiceRoute,
  parseVoiceResult,
} from "./parseVoiceResult.js";

describe("isAllowedVoiceRoute", () => {
  it("allows home, work, desk, and project routes", () => {
    assert.equal(isAllowedVoiceRoute("/"), true);
    assert.equal(isAllowedVoiceRoute("/work"), true);
    assert.equal(isAllowedVoiceRoute("/work?tab=projects"), true);
    assert.equal(isAllowedVoiceRoute("/work?tab=reminders"), true);
    assert.equal(isAllowedVoiceRoute("/work?tab=notes"), true);
    assert.equal(isAllowedVoiceRoute("/reminders"), true);
    assert.equal(isAllowedVoiceRoute("/reminders/12"), true);
    assert.equal(isAllowedVoiceRoute("/notes"), true);
    assert.equal(isAllowedVoiceRoute("/notes/3"), true);
    assert.equal(isAllowedVoiceRoute("/projects/revenue-factory"), true);
  });

  it("rejects external and unknown paths", () => {
    assert.equal(isAllowedVoiceRoute("https://evil.com"), false);
    assert.equal(isAllowedVoiceRoute("/settings"), false);
    assert.equal(isAllowedVoiceRoute("/projects/foo/bar"), false);
    assert.equal(isAllowedVoiceRoute("/task/voice"), false);
  });
});

describe("parseVoiceResult", () => {
  it("parses marker block", () => {
    const reply = `Done.\n\nVOICE_RESULT_JSON:\n{"spokenReply":"Added the reminder.","actionsTaken":["created_reminder"],"navigateTo":"/work","pendingAction":null}\nEND_VOICE_RESULT_JSON`;
    const parsed = parseVoiceResult(reply);
    assert.equal(parsed.spokenText, "Added the reminder.");
    assert.equal(parsed.navigateTo, "/work");
    assert.deepEqual(parsed.voice?.actionsTaken, ["created_reminder"]);
  });

  it("falls back when JSON invalid", () => {
    const reply = `Hello there\n\nVOICE_RESULT_JSON:\n{not json\nEND_VOICE_RESULT_JSON`;
    const parsed = parseVoiceResult(reply);
    assert.equal(parsed.spokenText, "Hello there");
    assert.equal(parsed.voice, null);
  });

  it("rejects disallowed navigateTo", () => {
    const reply = formatMockVoiceReply("ok", { navigateTo: "https://evil.com" });
    const parsed = parseVoiceResult(reply);
    assert.equal(parsed.navigateTo, null);
  });

  it("strips markers from spoken fallback", () => {
    const reply = `Before text\nVOICE_RESULT_JSON:\n{"spokenReply":"Hi"}\nEND_VOICE_RESULT_JSON`;
    const parsed = parseVoiceResult(reply);
    assert.equal(parsed.spokenText, "Hi");
  });
});
