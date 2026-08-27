import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { PhoneVerificationConfirmDto } from "./dto/phone-verification-confirm.dto";
import { PhoneVerificationService } from "./phone-verification.service";

@Controller("phone-verification")
export class PhoneVerificationController {
  constructor(
    private readonly phoneVerificationService: PhoneVerificationService,
  ) {}

  @Post("request")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AccessTokenGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  async requestChallenge(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<{ accepted: true }> {
    await this.phoneVerificationService.requestChallenge(currentUser.id);

    return { accepted: true };
  }

  @Post("confirm")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  async confirmCode(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() input: PhoneVerificationConfirmDto,
  ): Promise<void> {
    await this.phoneVerificationService.confirmCode(currentUser.id, input.code);
  }
}
