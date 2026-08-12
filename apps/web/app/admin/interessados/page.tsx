import type { Metadata } from "next";

import { LaunchInterestsPage } from "../../../components/admin/launch-interests-page";

export const metadata: Metadata = {
  title: "Interessados do lançamento | Soravi",
  description:
    "Acompanhe os interessados no lançamento da Soravi em uma visão administrativa segura.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLaunchInterestsRoute() {
  return <LaunchInterestsPage />;
}
