import type { Metadata } from "next";

import { AccountHubPage } from "../../components/account/account-hub-page";

export const metadata: Metadata = {
  title: "Minha conta | Soravi",
  description: "Acesse as configurações da sua conta Soravi.",
};

export default function AccountRoute() {
  return <AccountHubPage />;
}
