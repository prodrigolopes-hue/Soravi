import { Role } from "../../generated/prisma/client";
import { ROLES_KEY } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { FavoritesController } from "./favorites.controller";
import { FavoritesService } from "./favorites.service";

describe("FavoritesController", () => {
  const favoritesService = {
    create: jest.fn(),
    remove: jest.fn(),
    findMine: jest.fn(),
  };
  const controller = new FavoritesController(
    favoritesService as unknown as FavoritesService,
  );
  const user = {
    id: "user-1",
    sessionId: "session-1",
    roles: [Role.CUSTOMER],
    phoneVerifiedAt: new Date(),
  };

  afterEach(() => jest.clearAllMocks());

  it("protege todas as operacoes para clientes autenticados", () => {
    expect(Reflect.getMetadata("__guards__", FavoritesController)).toEqual([
      AccessTokenGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, FavoritesController)).toEqual([
      Role.CUSTOMER,
    ]);
  });

  it("encaminha a alternancia entre criar e remover ao cliente atual", async () => {
    favoritesService.create.mockResolvedValue({ id: "favorite-1" });
    favoritesService.remove.mockResolvedValue(undefined);

    await expect(controller.create(user, "professional-1")).resolves.toEqual({
      id: "favorite-1",
    });
    await expect(controller.remove(user, "professional-1")).resolves.toBeUndefined();

    expect(favoritesService.create).toHaveBeenCalledWith("user-1", "professional-1");
    expect(favoritesService.remove).toHaveBeenCalledWith("user-1", "professional-1");
  });
});
