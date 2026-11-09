import type { Metadata } from "next";
import { connection } from "next/server";
import { composeModel } from "@/lib/compose-model";
import { Compose } from "./compose";

export const metadata: Metadata = {
  title: "Compose · Zernio Elements",
  description: "An agent writes a JSON spec; json-render validates it against the catalog and renders the real components.",
};

export default async function Page() {
  await connection(); // read the env per request, not at build time
  return <Compose model={composeModel()?.label ?? null} />;
}
