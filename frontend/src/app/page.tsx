import { redirect } from "next/navigation";
import { USE_MOCK } from "@/shared/config/app";

export default function RootPage() {
  redirect(USE_MOCK ? "/overview" : "/projects");
}
