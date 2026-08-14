import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";

import { PrismaModule } from "../../database/prisma.module";
import { CategorySuggestionsController } from "./category-suggestions.controller";
import { CategorySuggestionsService } from "./category-suggestions.service";

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRoot([
      {
        ttl: 600_000,
        limit: 5,
      },
    ]),
  ],
  controllers: [CategorySuggestionsController],
  providers: [CategorySuggestionsService],
})
export class CategorySuggestionsModule {}
