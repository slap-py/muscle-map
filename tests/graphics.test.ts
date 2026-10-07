import { describe, expect, it } from "vitest";
import { createSlowFrameMonitor, graphicsSettings, resolveTier, weakDeviceReason } from "../src/graphics";

describe("graphics tiers", () => {
  it("detects integrated, mobile and software GPUs but not discrete ones", () => {
    expect(weakDeviceReason({ gpu: "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11)" })).toBeTruthy();
    expect(weakDeviceReason({ gpu: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))" })).toBeTruthy();
    expect(weakDeviceReason({ gpu: "Mali-G57" })).toBeTruthy();
    expect(weakDeviceReason({ gpu: "ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics Direct3D11)" })).toBeNull();
    expect(weakDeviceReason({ gpu: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)", memory: 8 })).toBeNull();
    expect(weakDeviceReason({ gpu: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)", memory: 4 })).toBeTruthy();
  });

  it("keeps automated validation on the baseline renderer", () => {
    expect(weakDeviceReason({ gpu: "SwiftShader", automated: true })).toBeNull();
  });

  it("lets explicit choices win and Auto follow detection or the prompt answer", () => {
    expect(resolveTier("high", "integrated graphics", "low")).toBe("high");
    expect(resolveTier("low", null, null)).toBe("low");
    expect(resolveTier("auto", "integrated graphics", null)).toBe("low");
    expect(resolveTier("auto", null, "low")).toBe("low");
    expect(resolveTier("auto", null, "keep")).toBe("high");
    expect(resolveTier("auto", null, null)).toBe("high");
  });

  it("only cuts cost in Low", () => {
    const { high, low } = graphicsSettings;
    expect(low.maxPixelRatio).toBeLessThan(high.maxPixelRatio);
    expect([low.shadows, low.taaSamples, low.thinHoverAssist]).toEqual([false, 0, false]);
    expect(low.maxPassiveLabels).toBeLessThan(high.maxPassiveLabels);
  });

  it("flags sustained slow motion and ignores stalls", () => {
    const monitor = createSlowFrameMonitor(10, 40);
    for (let i = 0; i < 9; i++) expect(monitor.add(60)).toBe(false);
    expect(monitor.add(1000)).toBe(false);
    expect(monitor.add(60)).toBe(true);
    monitor.reset();
    for (let i = 0; i < 10; i++) expect(monitor.add(16)).toBe(false);
  });
});
