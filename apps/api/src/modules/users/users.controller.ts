import {
    Controller,
    Get,
    UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { UserResponseDto } from "./dto/user-response.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
    ) { }

    @Get("me")
    @UseGuards(AccessTokenGuard)
    findCurrentUser(
        @CurrentUser() currentUser: AuthenticatedUser,
    ): Promise<UserResponseDto> {
        return this.usersService.findSafeById(
            currentUser.id,
        );
    }
}