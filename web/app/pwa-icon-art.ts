import { createElement } from "react";

export function createPayphloIcon(maskable: boolean) {
  const mark = createElement(
    "svg",
    {
      width: "58%",
      height: "58%",
      viewBox: "0 0 40 40",
      fill: "none",
    },
    createElement("path", {
      d: "M13 11h9.2c3.9 0 6.8 2.6 6.8 6.4 0 3.8-2.9 6.4-6.8 6.4H17V29h-4V11zm4 3.4v5.9h4.8c1.7 0 2.9-1.2 2.9-2.95s-1.2-2.95-2.9-2.95H17z",
      fill: "#04130a",
    }),
  );

  const tile = createElement(
    "div",
    {
      style: {
        alignItems: "center",
        background: "linear-gradient(135deg, #00f293, #00a35e)",
        borderRadius: maskable ? "24%" : "0%",
        display: "flex",
        height: maskable ? "64%" : "100%",
        justifyContent: "center",
        width: maskable ? "64%" : "100%",
      },
    },
    mark,
  );

  return createElement(
    "div",
    {
      style: {
        alignItems: "center",
        background: maskable ? "#07090b" : "#00d97e",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      },
    },
    tile,
  );
}
