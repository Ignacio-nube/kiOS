import { describe, expect, it } from "vitest";
import {
  dateInputsToRange, lastNDaysRange, thisMonthRange, todayRange, toDateInputValue, yesterdayRange,
} from "./dates";

const NOW = new Date(2026, 6, 22, 15, 30, 0); // 22 jul 2026, 15:30 local

describe("todayRange", () => {
  it("cubre desde el inicio del día local hasta el inicio del siguiente", () => {
    const range = todayRange(NOW);
    const from = new Date(range.from);
    const to = new Date(range.to);
    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("yesterdayRange", () => {
  it("es el día anterior completo, sin solaparse con hoy", () => {
    const today = todayRange(NOW);
    const yesterday = yesterdayRange(NOW);
    expect(yesterday.to).toBe(today.from);
    expect(new Date(today.from).getTime() - new Date(yesterday.from).getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("lastNDaysRange", () => {
  it("incluye hoy y los N-1 días previos", () => {
    const range = lastNDaysRange(7, NOW);
    const today = todayRange(NOW);
    expect(range.to).toBe(today.to); // hasta el final de hoy
    expect(new Date(range.to).getTime() - new Date(range.from).getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("thisMonthRange", () => {
  it("va del día 1 del mes al día 1 del mes siguiente", () => {
    const range = thisMonthRange(NOW);
    expect(new Date(range.from).getDate()).toBe(1);
    expect(new Date(range.from).getMonth()).toBe(6); // julio (0-indexado)
    expect(new Date(range.to).getMonth()).toBe(7); // agosto
  });
});

describe("dateInputsToRange / toDateInputValue", () => {
  it("son inversas entre sí para un rango de un solo día", () => {
    const day = toDateInputValue(NOW);
    const range = dateInputsToRange(day, day);
    expect(range).toEqual(todayRange(NOW));
  });

  it("el 'hasta' es inclusive: cubre el día completo", () => {
    const range = dateInputsToRange("2026-07-01", "2026-07-03");
    expect(new Date(range.to).getTime() - new Date(range.from).getTime()).toBe(3 * 24 * 60 * 60 * 1000);
  });
});
