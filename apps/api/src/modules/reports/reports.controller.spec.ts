import { RolesGuard } from "../auth/guards/roles.guard";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { Role } from "../../generated/prisma/client";
import { ReportsController } from "./reports.controller";

describe("ReportsController", () => {
  it("restringe fila, detalhe e decisão ao ADMIN", () => {
    for (const method of [ReportsController.prototype.list, ReportsController.prototype.detail, ReportsController.prototype.update]) {
      expect(Reflect.getMetadata("__guards__", method)).toEqual([AccessTokenGuard, RolesGuard]);
      expect(Reflect.getMetadata("roles", method)).toEqual([Role.ADMIN]);
    }
  });
});
