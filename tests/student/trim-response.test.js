import { describe, expect, test } from "vitest";

import {
  degreesToRadians,
  calculateCm,
  calculateTrimAngleDeg,
  calculateDeltaCm,
  classifyDisturbance,
  calculateTrimResponse,
  isTrimmed
} from "../../src/student/physics/trim-response.js";

describe("trim-response physics", () => {
  test("numerical reference case", () => {
    const alphaRad = degreesToRadians(2.86);
    const deltaAlphaRad = degreesToRadians(2.0);

    expect(alphaRad).toBeCloseTo(0.0499164166, 9);
    expect(deltaAlphaRad).toBeCloseTo(0.0349065850, 9);

    expect(
      calculateCm(0.04, -0.8, 2.86)
    ).toBeCloseTo(0.0000668667, 9);

    expect(
      calculateTrimAngleDeg(0.04, -0.8)
    ).toBeCloseTo(2.8647889757, 9);

    expect(
      calculateDeltaCm(-0.8, 2.0)
    ).toBeCloseTo(-0.027925268, 9);

    const response = calculateTrimResponse({
      cm0: 0.04,
      cmAlphaPerRad: -0.8,
      angleOfAttackDeg: 2.86,
      disturbanceAlphaDeg: 2.0
    });

    expect(response.trimmed).toBe(false);
    expect(response.tendency).toBe("restoring");
  });

  test("reversing the disturbance changes delta_Cm sign but remains restoring", () => {
    const positiveDeltaCm = calculateDeltaCm(-0.8, 2.0);
    const negativeDeltaCm = calculateDeltaCm(-0.8, -2.0);

    expect(positiveDeltaCm).toBeLessThan(0);
    expect(negativeDeltaCm).toBeGreaterThan(0);

    expect(
      classifyDisturbance(-2.0, negativeDeltaCm)
    ).toBe("restoring");
  });

  test("zero slope produces no unique trim angle and neutral disturbance", () => {
    expect(
      calculateTrimAngleDeg(0.04, 0)
    ).toBeNull();

    expect(
      calculateDeltaCm(0, 2.0)
    ).toBe(0);

    expect(
      classifyDisturbance(2.0, 0)
    ).toBe("neutral");
  });

  test("zero disturbance produces neutral tendency", () => {
    expect(
      calculateDeltaCm(-0.8, -0)
    ).toBe(0);

    expect(
      classifyDisturbance(0, 0)
    ).toBe("neutral");
  });

  test("doubling disturbance doubles delta_Cm magnitude", () => {
    const single = calculateDeltaCm(-0.8, 2.0);
    const doubled = calculateDeltaCm(-0.8, 4.0);

    expect(Math.abs(doubled)).toBeCloseTo(
      2 * Math.abs(single),
      12
    );
  });

  test("trim tolerance is applied at 1e-6", () => {
    expect(isTrimmed(1e-6)).toBe(true);
    expect(isTrimmed(-1e-6)).toBe(true);
    expect(isTrimmed(1.000001e-6)).toBe(false);
  });

  test("invalid numeric inputs are rejected", () => {
    expect(() =>
      calculateCm(NaN, -0.8, 2.86)
    ).toThrow();

    expect(() =>
      calculateCm(0.04, Infinity, 2.86)
    ).toThrow();

    expect(() =>
      calculateDeltaCm(-0.8, Number.NaN)
    ).toThrow();

    expect(() =>
      calculateTrimAngleDeg(0.04, -Infinity)
    ).toThrow();
  });
});