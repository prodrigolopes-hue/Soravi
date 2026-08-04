export interface CategoryResponseDtoProperties {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  displayOrder: number;
}

export class CategoryResponseDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly icon: string | null;
  readonly displayOrder: number;

  constructor(properties: CategoryResponseDtoProperties) {
    this.id = properties.id;
    this.name = properties.name;
    this.slug = properties.slug;
    this.description = properties.description;
    this.icon = properties.icon;
    this.displayOrder = properties.displayOrder;
  }
}
