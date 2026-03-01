/**
 * tests/ui-focus-ring.test.tsx
 *
 * Verify that Button and Input have focus-visible ring classes baked into
 * their rendered className (2 tests).
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { Button } from "@/features/common/ui/Button";
import { Input } from "@/features/common/ui/Input";

describe("focus-visible ring classes", () => {
  it("Button renders with focus-visible ring class", () => {
    const { getByRole } = render(<Button>Click me</Button>);
    expect(getByRole("button").className).toMatch(/focus-visible/);
  });

  it("Input renders with focus-visible ring class", () => {
    const { getByRole } = render(<Input placeholder="type here" />);
    expect(getByRole("textbox").className).toMatch(/focus-visible/);
  });
});
