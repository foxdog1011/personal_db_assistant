/**
 * tests/Modal.a11y.test.tsx
 *
 * Accessibility tests for the Modal component (4 tests):
 *   1. role=dialog + aria-modal present
 *   2. Panel receives focus on open
 *   3. Tab key cycles focus within modal (focus trap)
 *   4. Focus restored to opener element on close
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { Modal } from "@/features/common/ui/Modal";

// ── helpers ─────────────────────────────────────────────────────────────────

function renderModal(open = true, title: string | undefined = "Test title") {
  const onClose = vi.fn();
  const result = render(
    <Modal open={open} onClose={onClose} title={title}>
      <button>B1</button>
      <button>B2</button>
    </Modal>
  );
  return { ...result, onClose };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe("Modal — a11y", () => {
  it("panel has role=dialog and aria-modal=true", () => {
    renderModal();
    const panel = screen.getByRole("dialog");
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute("aria-modal", "true");
  });

  it("focuses the panel on open", () => {
    renderModal();
    const panel = screen.getByRole("dialog");
    expect(panel).toHaveFocus();
  });

  it("Tab from last focusable element cycles back to first (focus trap)", () => {
    renderModal();
    // Focusable elements inside panel: [× close, B1, B2]
    const buttons = screen.getAllByRole("button");
    const closeBtn = buttons[0]; // the × header button
    const b2 = buttons[buttons.length - 1]; // "B2"

    b2.focus();
    expect(document.activeElement).toBe(b2);

    // Dispatch Tab — our handler intercepts and cycles to first
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })
    );

    expect(document.activeElement).toBe(closeBtn);
  });

  it("restores focus to the opener element when closed", () => {
    // Create and focus an "opener" button outside the modal
    const opener = document.createElement("button");
    opener.textContent = "Open modal";
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { rerender, onClose } = renderModal(true);
    // Modal is open — focus moved to panel

    // Close the modal
    rerender(
      <Modal open={false} onClose={onClose} title="Test title">
        <button>B1</button>
        <button>B2</button>
      </Modal>
    );

    expect(document.activeElement).toBe(opener);

    document.body.removeChild(opener);
  });
});
