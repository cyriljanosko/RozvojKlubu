import { describe, expect, it } from "vitest";

import * as ds from "./ds";

describe("SFZ Design System layer", () => {
  it("re-exports the design-system components the redesign uses", () => {
    const names = [
      "Alert",
      "Avatar",
      "Badge",
      "Button",
      "Card",
      "Checkbox",
      "Chip",
      "DataTable",
      "Drawer",
      "EmptyState",
      "Icon",
      "IconButton",
      "Input",
      "Modal",
      "Select",
      "Stepper",
      "Table",
      "Tabs",
      "Textarea",
      "Toggle",
    ] as const;
    for (const name of names) expect(ds[name], name).toBeTruthy();
  });
});
