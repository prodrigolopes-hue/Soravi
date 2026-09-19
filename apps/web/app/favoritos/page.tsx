import type { Metadata } from "next";

import { FavoritesPage } from "../../components/favorites/favorites-page";

export const metadata: Metadata = { title: "Favoritos | Soravi", description: "Profissionais favoritos na Soravi." };

export default function FavoritesRoute() { return <FavoritesPage />; }
