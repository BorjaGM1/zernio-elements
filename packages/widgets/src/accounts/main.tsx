import { safeAreaStyle, useWidget } from "../bridge";
import { mount } from "../root";
import { parseAccounts } from "../types";
import { Accounts, AccountsError, AccountsSkeleton } from "./Accounts";

function Widget() {
  const w = useWidget("accounts");
  const data = w.result === undefined ? null : parseAccounts(w.result);
  return (
    <div style={safeAreaStyle(w.host)}>
      {w.resultError ? (
        <AccountsError message={w.resultError} />
      ) : data ? (
        <Accounts data={data} actions={w.actions} />
      ) : w.result !== undefined ? (
        <AccountsError message="The tool returned data this widget doesn't understand." />
      ) : w.connectError ? (
        <AccountsError message={w.connectError.message} />
      ) : (
        <AccountsSkeleton />
      )}
    </div>
  );
}

mount(<Widget />);
