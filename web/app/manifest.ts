import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Payphlo — Send, Invest, Ask",
    short_name: "Payphlo",
    description:
      "Send money home, practice investing, and get plain-English financial guidance.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#07090b",
    theme_color: "#07090b",
    categories: ["finance", "utilities"],
    icons: [
      {
        src: "/pwa-icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-maskable/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/pwa-maskable/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Home",
        url: "/dashboard",
        icons: [{ src: "/pwa-icon/192", sizes: "192x192" }],
      },
      {
        name: "Send money",
        short_name: "Send",
        url: "/transfers",
        icons: [{ src: "/pwa-icon/192", sizes: "192x192" }],
      },
      {
        name: "Ask Phlo",
        short_name: "Phlo",
        url: "/assistant",
        icons: [{ src: "/pwa-icon/192", sizes: "192x192" }],
      },
    ],
  };
}
