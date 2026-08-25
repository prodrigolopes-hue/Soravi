import { NotFoundException } from "@nestjs/common";

export class NotificationNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: "NOTIFICATION_NOT_FOUND",
      message: "Notificação não encontrada.",
    });
  }
}
