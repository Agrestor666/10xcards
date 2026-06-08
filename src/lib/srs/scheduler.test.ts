import { describe, expect, it } from "vitest";

import { scheduler } from "@/lib/srs/scheduler";

describe("scheduler", () => {
  it("exports a ts-fsrs scheduler instance", () => {
    expect(scheduler).toBeDefined();
  });
});

