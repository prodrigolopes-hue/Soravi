import { Controller, Get, Header, Param, ParseUUIDPipe, Query } from "@nestjs/common";

import { PublicProfessionalDiscoveryQueryDto } from "./dto/public-professional-discovery-query.dto";
import { PublicProfessionalListResponseDto } from "./dto/public-professional-list-response.dto";
import { PublicProfessionalProfileResponseDto } from "./dto/public-professional-profile-response.dto";
import { ProfessionalDiscoveryService } from "./professional-discovery.service";

@Controller()
export class ProfessionalDiscoveryController {
  constructor(
    private readonly professionalDiscoveryService: ProfessionalDiscoveryService,
  ) {}

  @Get("categories/:categorySlug/professionals")
  @Header("Cache-Control", "no-store")
  findByCategory(
    @Param("categorySlug") categorySlug: string,
    @Query() query: PublicProfessionalDiscoveryQueryDto,
  ): Promise<PublicProfessionalListResponseDto> {
    return this.professionalDiscoveryService.findByCategory(categorySlug, query);
  }

  @Get("professionals/:professionalProfileId")
  @Header("Cache-Control", "no-store")
  findOne(
    @Param("professionalProfileId", new ParseUUIDPipe()) professionalProfileId: string,
    @Query() query: PublicProfessionalDiscoveryQueryDto,
  ): Promise<PublicProfessionalProfileResponseDto> {
    return this.professionalDiscoveryService.findOne(professionalProfileId, query);
  }
}
