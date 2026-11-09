"use client";

import {
  ZernioProvider,
  ConnectAccounts,
  Composer,
  Calendar,
} from "@zernio-elements/react";

export default function Social() {
  return (
    <ZernioProvider>
      <ConnectAccounts />
      <Composer />
      <Calendar />
    </ZernioProvider>
  );
}
