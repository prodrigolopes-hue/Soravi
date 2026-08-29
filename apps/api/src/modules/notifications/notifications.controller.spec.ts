import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { Role } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { NotificationsQueryDto } from "./dto/notifications-query.dto";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

describe("NotificationsController", () => {
  const serviceMock = {
    countUnread: jest.fn(),
    findAll: jest.fn(),
    markAsRead: jest.fn(),
  };
  const controller = new NotificationsController(
    serviceMock as unknown as NotificationsService,
  );
  const currentUser = {
    id: "525afb87-2b81-4de7-9606-8f382fff3341",
    sessionId: "session-id",
    roles: [Role.CUSTOMER],
    phoneVerifiedAt: null,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("retorna o contador do usuário autenticado", async () => {
    serviceMock.countUnread.mockResolvedValue({ count: 3 });

    await expect(controller.countUnread(currentUser)).resolves.toEqual({ count: 3 });
    expect(serviceMock.countUnread).toHaveBeenCalledWith(currentUser.id);
  });

  it("mantém unread-count como rota estática distinta da rota parametrizada", () => {
    const unreadCountPath = Reflect.getMetadata(
      "path",
      NotificationsController.prototype.countUnread,
    );
    const markAsReadPath = Reflect.getMetadata(
      "path",
      NotificationsController.prototype.markAsRead,
    );

    expect(unreadCountPath).toBe("unread-count");
    expect(markAsReadPath).toBe(":notificationId/read");
  });

  it("aplica paginação default", async () => {
    serviceMock.findAll.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    await controller.findAll(currentUser, {});

    expect(serviceMock.findAll).toHaveBeenCalledWith(currentUser.id, 1, 20);
  });

  it("rejeita limit acima do máximo", async () => {
    const query = plainToInstance(NotificationsQueryDto, { limit: 101 });

    const errors = await validate(query);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: "limit" }),
      ]),
    );
  });

  it("protege os endpoints com AccessTokenGuard", () => {
    const listGuards = Reflect.getMetadata(
      "__guards__",
      NotificationsController.prototype.findAll,
    );
    const readGuards = Reflect.getMetadata(
      "__guards__",
      NotificationsController.prototype.markAsRead,
    );
    const unreadCountGuards = Reflect.getMetadata(
      "__guards__",
      NotificationsController.prototype.countUnread,
    );

    expect(listGuards).toEqual([AccessTokenGuard]);
    expect(readGuards).toEqual([AccessTokenGuard]);
    expect(unreadCountGuards).toEqual([AccessTokenGuard]);
  });
});
