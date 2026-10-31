import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileChecks, MAX_BYTES, resolutionCheck, sniffFormat } from "./file-checks";

const fixture = (name: string) => new Uint8Array(readFileSync(`tests/fixtures/photos/${name}`).subarray(0, 32));

describe("sniffFormat", () => {
  it("identifies formats from their signatures, not the file name", () => {
    expect(sniffFormat(fixture("front.jpg"))).toBe("jpeg");
    expect(sniffFormat(fixture("front.png"))).toBe("png");
    expect(sniffFormat(fixture("front.webp"))).toBe("webp");
    expect(sniffFormat(fixture("photo.heic"))).toBe("heic");
    expect(sniffFormat(fixture("not-an-image.jpg"))).toBeNull(); // text named .jpg
    expect(sniffFormat(fixture("unsupported.gif"))).toBeNull();
  });
});

describe("fileChecks", () => {
  it("passes a supported file within the size limit", () => {
    const checks = fileChecks({ size: 2_000_000, name: "me.jpg" }, "jpeg");
    expect(checks.map((c) => c.status)).toEqual(["pass", "pass"]);
  });

  it("rejects files over 20 MB with a specific message", () => {
    const size = fileChecks({ size: MAX_BYTES + 1, name: "big.jpg" }, "jpeg").find((c) => c.id === "size")!;
    expect(size.status).toBe("fail");
    expect(size.message).toMatch(/over the 20 MB limit/);
    expect(fileChecks({ size: MAX_BYTES, name: "ok.jpg" }, "jpeg").find((c) => c.id === "size")!.status).toBe("pass");
  });

  it("names unsupported formats", () => {
    const format = fileChecks({ size: 10, name: "anim.gif" }, null)[0];
    expect(format).toMatchObject({ status: "fail" });
    expect(format.message).toMatch(/GIF files aren’t supported/);
    expect(fileChecks({ size: 10, name: "x.docx" }, null)[0].message).toMatch(/JPG, PNG, WebP or HEIC/);
  });

  it("rejects empty files", () => {
    expect(fileChecks({ size: 0, name: "e.jpg" }, "jpeg")[1].status).toBe("fail");
  });
});

describe("resolutionCheck", () => {
  it("requires 1024 px on the short side", () => {
    expect(resolutionCheck(1024, 1365).status).toBe("pass");
    expect(resolutionCheck(1023, 4000)).toMatchObject({ status: "fail" });
    expect(resolutionCheck(600, 655).message).toMatch(/too small/);
  });

  it("refuses images too large to process", () => {
    expect(resolutionCheck(10000, 8000).message).toMatch(/too large/);
  });
});
