import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const buildDirectory = mkdtempSync(join(tmpdir(), "finance-tracker-icons-"));
let builtHtml = "";

beforeAll(async () => {
  await build({
    logLevel: "silent",
    build: {
      emptyOutDir: true,
      outDir: buildDirectory,
    },
  });
  builtHtml = readFileSync(join(buildDirectory, "index.html"), "utf8");
});

afterAll(() => {
  rmSync(buildDirectory, { recursive: true, force: true });
});

function readPngDimensions(path: string) {
  const image = readFileSync(path);

  expect(image.subarray(1, 4).toString("ascii")).toBe("PNG");

  return {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20),
  };
}

describe("iPhone Home Screen icon", () => {
  it("publishes a 180px Apple touch icon", () => {
    expect(readPngDimensions("public/apple-touch-icon.png")).toEqual({
      width: 180,
      height: 180,
    });
  });

  it("links the Apple touch icon from the document head", () => {
    expect(builtHtml).toContain(
      '<link rel="apple-touch-icon" sizes="180x180" href="/finance-tracker/apple-touch-icon.png" />',
    );
  });
});

describe("desktop browser icon", () => {
  it("publishes a 32px PNG favicon", () => {
    expect(readPngDimensions("public/favicon-32x32.png")).toEqual({
      width: 32,
      height: 32,
    });
  });

  it("links the PNG favicon in the production document", () => {
    expect(builtHtml).toContain(
      '<link rel="icon" type="image/png" sizes="32x32" href="/finance-tracker/favicon-32x32.png" />',
    );
    expect(builtHtml).not.toContain("data:image/svg+xml");
  });

});
