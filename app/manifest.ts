import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TimeShield",
    short_name: "TimeShield",
    description: "次にやる一手を即提示するフォーカス用タイムラインアプリ",
    start_url: "/focus",
    display: "standalone",
    theme_color: "#f97316",
    background_color: "#ffffff",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}
