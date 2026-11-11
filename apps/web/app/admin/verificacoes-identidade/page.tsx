import type { Metadata } from "next";
import { AdminIdentityReviewsPage } from "../../../components/admin/admin-identity-reviews-page";
export const metadata: Metadata = { title: "Identidades | Administração Soravi", robots: { index: false, follow: false } };
export default function Route() { return <AdminIdentityReviewsPage />; }
