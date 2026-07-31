/** @type {import("jest").Config} */
module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  testRegex: ".*\\.spec\\.ts$",
  moduleFileExtensions: ["js", "json", "ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.spec.json",
      },
    ],
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/generated/**",
    "!src/main.ts",
    "!src/**/*.module.ts",
    "!src/**/*.dto.ts",
  ],
  coverageDirectory: "coverage",
  clearMocks: true,
  restoreMocks: true,
};
