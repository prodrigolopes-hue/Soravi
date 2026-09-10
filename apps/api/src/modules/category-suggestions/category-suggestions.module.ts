import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { AccessTokenModule } from "../auth/access-token.module";
import { CategorySuggestionsController } from "./category-suggestions.controller";
import { CategorySuggestionsService } from "./category-suggestions.service";

@Module({
  imports: [
    PrismaModule,
    AccessTokenModule,
  ],
  controllers: [CategorySuggestionsController],
  providers: [CategorySuggestionsService],
})
export class CategorySuggestionsModule {}
