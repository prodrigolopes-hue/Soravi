import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

import { LaunchInterestsService } from "./launch-interests.service";
import { CreateLaunchInterestDto } from "./dto/create-launch-interest.dto";
import { LaunchInterestRegistrationResponseDto } from "./dto/launch-interest-response.dto";

@Controller("launch-interests")
export class LaunchInterestsController {
  constructor(
    private readonly launchInterestsService: LaunchInterestsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  register(
    @Body() input: CreateLaunchInterestDto,
  ): Promise<LaunchInterestRegistrationResponseDto> {
    return this.launchInterestsService.register(input);
  }
}
