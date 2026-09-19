// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Select from "@/components/Select";

const OPTIONS = [
  { id: "restock", label: "Restock" },
  { id: "adjustment", label: "Correction" },
  { id: "other", label: "Other reason" },
];

function Harness({
  onChange = () => {},
  variant,
}: {
  onChange?: (value: string) => void;
  variant?: "field" | "menu";
}) {
  const [value, setValue] = useState("restock");
  return (
    <div>
      <label htmlFor="reason">Reason</label>
      <Select
        id="reason"
        label="Reason"
        options={OPTIONS}
        value={value}
        variant={variant}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
      <button type="button">Elsewhere</button>
    </div>
  );
}

// The button is named by the label beside it, so find it by the id the label points at.
const trigger = () => document.getElementById("reason") as HTMLButtonElement;

describe("Select", () => {
  it("shows the current choice on a closed button", () => {
    render(<Harness />);
    expect(trigger().textContent).toContain("Restock");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(trigger().getAttribute("aria-haspopup")).toBe("listbox");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("opens a listbox with every option and marks the current one", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(trigger());

    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Restock", "Correction", "Other reason"]);
    expect(options.map((o) => o.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    expect(screen.getByRole("listbox").getAttribute("aria-label")).toBe("Reason");
  });

  it("chooses an option with a click and closes", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    await user.click(trigger());
    await user.click(screen.getByRole("option", { name: "Correction" }));

    expect(onChange).toHaveBeenCalledWith("adjustment");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger().textContent).toContain("Correction");
  });

  it("moves with the arrow keys, chooses with Enter and returns focus to the button", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    trigger().focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox").getAttribute("aria-activedescendant")).toBe(
      screen.getAllByRole("option")[0]!.id
    );

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("other");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("stops at the ends of the list, and Home and End jump to them", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    trigger().focus();
    await user.keyboard("{ArrowDown}{End}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("other");

    await user.keyboard("{ArrowUp}{Home}{ArrowUp}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("restock");
  });

  it("jumps to the next option that starts with the typed letter", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    trigger().focus();
    await user.keyboard("{ArrowDown}o{Enter}");

    expect(onChange).toHaveBeenCalledWith("other");
  });

  it("closes on Escape without changing the value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    trigger().focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Escape}");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("closes when the user clicks elsewhere", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(trigger());
    expect(screen.getByRole("listbox")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("names the labelled menu style from its visible label", async () => {
    const user = userEvent.setup();
    render(<Harness variant="menu" />);

    await user.click(trigger());

    const list = screen.getByRole("listbox");
    const labelId = list.getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelId)?.textContent).toBe("Reason");
  });
});
