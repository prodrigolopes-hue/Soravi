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
  };

  afterEach(() => {
    jest.clearAllMocks();
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

    expect(listGuards).toEqual([AccessTokenGuard]);
    expect(readGuards).toEqual([AccessTokenGuard]);
  });
});
