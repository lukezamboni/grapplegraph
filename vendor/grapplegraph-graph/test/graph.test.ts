import { describe, expect, it } from "vitest";
import Graph from "../src/components/Graph";
import render from "preact-render-to-string";
import fs from "node:fs";

describe("Graph Component", () => {
  it("should create a Graph component with default options", () => {
    const component = Graph({});

    expect(component).toBeDefined();
    expect(typeof component).toBe("function");
  });

  it("should create a Graph component with custom options", () => {
    const component = Graph({
      localGraph: {
        depth: 2,
        drag: false,
        zoom: true,
      },
      globalGraph: {
        depth: -1,
        focusOnHover: true,
      },
    });

    expect(component).toBeDefined();
    expect(typeof component).toBe("function");
  });

  it("should export component with css property", () => {
    const component = Graph({});

    expect(component.css).toBeDefined();
    expect(typeof component.css).toBe("string");
  });

  it("should export component with afterDOMLoaded script", () => {
    const component = Graph({});

    expect(component.afterDOMLoaded).toBeDefined();
    expect(typeof component.afterDOMLoaded).toBe("string");

    const source = fs.readFileSync(
      new URL("../src/components/scripts/graph.inline.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("cdn.jsdelivr.net");
    expect(source).toContain("spaNavigate");
  });

  it("renders accessible filters in belt-progression order", () => {
    const component = Graph({});
    const markup = render(component({ displayClass: "desktop-only" } as never) as never);

    expect(markup).toContain('aria-label="Expand technique map"');
    expect(markup.indexOf(">Blue<")).toBeLessThan(markup.indexOf(">Purple<"));
    expect(markup.indexOf(">Purple<")).toBeLessThan(markup.indexOf(">Brown-only<"));
  });
});
