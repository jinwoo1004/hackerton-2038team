import type { MetadataRoute } from "next";
import { APP } from "@/shared/config/app";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP.name,
    short_name: APP.shortName,
    description: APP.description,
    lang: "ko",
    start_url: "/projects",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#2563EB",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
