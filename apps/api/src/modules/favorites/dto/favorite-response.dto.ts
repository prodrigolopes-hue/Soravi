export interface FavoriteProfessionalProperties {
  id: string;
  displayName: string;
  averageRating: number;
  reviewCount: number;
  categories: string[];
}

export class FavoriteResponseDto {
  id!: string;
  professional!: FavoriteProfessionalProperties;
  createdAt!: Date;

  constructor(id: string, professional: FavoriteProfessionalProperties, createdAt: Date) {
    this.id = id;
    this.professional = professional;
    this.createdAt = createdAt;
  }
}
