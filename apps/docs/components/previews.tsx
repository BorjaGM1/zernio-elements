"use client";

import { CatalogView, EXAMPLES } from "@zernio-elements/catalog";
import { Composer, useAccounts, useComposer } from "@zernio-elements/react";
import type { PlatformId } from "@zernio-elements/rules";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Optional hand-written previews, keyed by catalog slug. Anything not listed here is rendered
 * generically from its catalog entry (export name + previewProps).
 */
export const CUSTOM_PREVIEWS: Record<string, () => ReactNode> = {
  composer: () => <ComposerDemo />,
  "catalog-weekly-report": () => <CatalogView spec={EXAMPLES.find((e) => e.id === "weekly-report")?.spec} />,
};

const DRAFT = `Summer availability is open for every listing in Cartagena, from the two-bedroom flat with sea views to the old town studio.

Book direct this week and skip the platform fees entirely. We answer every message within the hour, and late check-in is always free.

Reply here or send us a DM with your dates. #travel #cartagena`;

const PRESELECT: PlatformId[] = ["twitter", "instagram", "linkedin", "youtube"];

function ComposerDemo() {
  const controller = useComposer({ content: DRAFT });
  const accounts = useAccounts();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !accounts.data) return;
    done.current = true;
    for (const p of PRESELECT) {
      const acc = accounts.data.find((a) => a.platform === p);
      if (acc) controller.toggleTarget({ platform: p, accountId: acc._id });
    }
  }, [accounts.data, controller]);

  return <Composer controller={controller} />;
}
