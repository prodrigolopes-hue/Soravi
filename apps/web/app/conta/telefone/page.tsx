import type { Metadata } from "next";

import { AccountPhonePage } from "../../../components/account/account-phone-page";

export const metadata: Metadata = {
  title: "Telefone da conta | Soravi",
  description: "Altere e verifique o telefone da sua conta Soravi.",
};

export default function AccountPhoneRoute() {
  return <AccountPhonePage />;
}
