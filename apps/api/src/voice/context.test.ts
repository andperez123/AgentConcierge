import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildVoiceAgentMessage,
  buildMockVoiceReply,
  VOICE_CONTEXT_LIMITS,
} from "./context.js";

describe("buildVoiceAgentMessage", () => {
  it("includes user text and marker instructions", () => {
    const msg = buildVoiceAgentMessage("add a reminder to test");
    assert.match(msg, /add a reminder to test/i);
    assert.match(msg, /VOICE_RESULT_JSON:/);
    assert.match(msg, /END_VOICE_RESULT_JSON/);
    assert.match(msg, /pendingAction/);
    assert.match(msg, /dismiss reminder 4/i);
  });

  it("documents context caps in prompt", () => {
    const msg = buildVoiceAgentMessage("hello");
    assert.match(msg, /Reminders \(\d+ active\)/);
    assert.match(msg, /Projects \(\d+/);
    assert.match(msg, /Desk summary:/);
    assert.match(msg, /Recently completed reminders/);
  });
});

describe("buildMockVoiceReply", () => {
  it("returns valid marker block", () => {
    const reply = buildMockVoiceReply("test command");
    assert.match(reply, /VOICE_RESULT_JSON:/);
    assert.match(reply, /END_VOICE_RESULT_JSON/);
    assert.match(reply, /test command/);
  });
});

describe("VOICE_CONTEXT_LIMITS", () => {
  it("uses expected caps", () => {
    assert.equal(VOICE_CONTEXT_LIMITS.MAX_REMINDERS, 10);
    assert.equal(VOICE_CONTEXT_LIMITS.MAX_NOTES, 10);
    assert.equal(VOICE_CONTEXT_LIMITS.MAX_COMPLETED, 5);
    assert.equal(VOICE_CONTEXT_LIMITS.MAX_PROJECTS, 10);
    assert.equal(VOICE_CONTEXT_LIMITS.MAX_SUMMARY_CHARS, 500);
  });
});
