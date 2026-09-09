import { BadRequestException } from "@nestjs/common";

export class UserStatusTransitionNotAllowedException extends BadRequestException {
  constructor() {
    super({
      code: "USER_STATUS_TRANSITION_NOT_ALLOWED",
      message: "A transição de status do usuário não é permitida.",
    });
  }
}
