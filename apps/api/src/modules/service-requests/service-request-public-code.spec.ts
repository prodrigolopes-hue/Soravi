import { backfillServiceRequestPublicCodes, formatServiceRequestPublicCode, serviceRequestPublicCodeYear } from "./service-request-public-code";

describe("service request public code", () => {
  it("uses Sao Paulo time at the year boundary", () => {
    expect(serviceRequestPublicCodeYear(new Date("2027-01-01T01:30:00.000Z"))).toBe(2026);
    expect(serviceRequestPublicCodeYear(new Date("2027-01-01T03:30:00.000Z"))).toBe(2027);
  });

  it("pads annual sequences without capping them", () => {
    expect(formatServiceRequestPublicCode(2026, 1)).toBe("SO2026001");
    expect(formatServiceRequestPublicCode(2026, 1000)).toBe("SO20261000");
  });

  it("models unique sequences returned by concurrent reservations", () => {
    const returnedSequences = [1, 2, 3, 4];
    expect(new Set(returnedSequences.map((sequence) => formatServiceRequestPublicCode(2026, sequence))).size).toBe(4);
  });

  it("backfills existing records by creation date with id as a stable tie breaker", () => {
    const codes = backfillServiceRequestPublicCodes([
      { id: "b", createdAt: new Date("2026-05-01T12:00:00.000Z") },
      { id: "a", createdAt: new Date("2026-05-01T12:00:00.000Z") },
      { id: "c", createdAt: new Date("2027-01-01T12:00:00.000Z") },
    ]);
    expect(codes.get("a")).toBe("SO2026001");
    expect(codes.get("b")).toBe("SO2026002");
    expect(codes.get("c")).toBe("SO2027001");
  });
});
