import { validate } from "class-validator";

import { UserStatus } from "../../../generated/prisma/client";
import { UpdateUserAdminStatusDto } from "./update-user-admin-status.dto";

describe("UpdateUserAdminStatusDto", () => {
  it.each([UserStatus.ACTIVE, UserStatus.BLOCKED])("aceita %s", async (status) => {
    const dto = Object.assign(new UpdateUserAdminStatusDto(), { status });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([UserStatus.PENDING, UserStatus.SUSPENDED, UserStatus.DEACTIVATED, "active", "", null, undefined])(
    "rejeita %p",
    async (status) => {
      const dto = Object.assign(new UpdateUserAdminStatusDto(), { status });
      await expect(validate(dto)).resolves.not.toHaveLength(0);
    },
  );
});
