import { describe, expect, it } from "vitest";
import {
  isDeleteConfirmation,
  isLeaveConfirmation,
} from "./confirm-delete";

describe("typed confirmations", () => {
  it("accepts delete and leave, ignoring case and surrounding spaces", () => {
    expect(isDeleteConfirmation("delete")).toBe(true);
    expect(isDeleteConfirmation(" DELETE ")).toBe(true);
    expect(isLeaveConfirmation("leave")).toBe(true);
    expect(isLeaveConfirmation(" Leave ")).toBe(true);
  });

  it("rejects empty input and lookalikes so a mistype cannot confirm", () => {
    expect(isDeleteConfirmation("")).toBe(false);
    expect(isDeleteConfirmation("yes")).toBe(false);
    expect(isDeleteConfirmation("deleted")).toBe(false);
    expect(isLeaveConfirmation("")).toBe(false);
    expect(isLeaveConfirmation("left")).toBe(false);
    expect(isLeaveConfirmation("delete")).toBe(false);
  });
});
