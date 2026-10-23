import { describe, expect, it } from "vitest";
import { isLate, isOpen } from "../calls/lock";

const call = { opensAt: 120, locksAt: 300 };

describe("late answers", () => {
  it("is late after locksAt", () => {
    expect(isLate(call, 301)).toBe(true);
    expect(isLate(call, 3600)).toBe(true);
  });

  it("is late exactly at locksAt, the call is locked then", () => {
    expect(isLate(call, 300)).toBe(true);
  });

  it("is not late before locksAt", () => {
    expect(isLate(call, 120)).toBe(false);
    expect(isLate(call, 299)).toBe(false);
  });

  it("is only open between opensAt and locksAt", () => {
    expect(isOpen(call, 119)).toBe(false);
    expect(isOpen(call, 200)).toBe(true);
    expect(isOpen(call, 300)).toBe(false);
  });
});
