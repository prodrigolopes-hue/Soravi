import type { Metadata } from "next";

import { AccountDataPage } from "../../../components/account/account-data-page";

export const metadata: Metadata = {
  title: "Meus dados | Soravi",
  description: "Consulte os dados associados à sua conta Soravi.",
};

export default function AccountDataRoute() {
  return <AccountDataPage />;
}
