import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { STORAGE_SERVICE, type StorageService } from "../../storage/storage.service";

@Injectable()
export class PreProposalPhotoMaintenanceService {
  constructor(private readonly prisma: PrismaService, @Inject(STORAGE_SERVICE) private readonly storage: StorageService) {}
  async processBatch(now = new Date(), limit = 25): Promise<void> {
    const claims = await this.prisma.$transaction(async (tx) => {
      const candidates = await tx.$queryRaw<{id:string;objectKey:string}[]>(Prisma.sql`SELECT "id", "object_key" AS "objectKey" FROM "pre_proposal_response_photo_upload_candidates" WHERE ("status" = 'PENDING' AND "next_attempt_at" <= ${now}) OR ("status" = 'PROCESSING' AND "lease_expires_at" <= ${now}) ORDER BY "next_attempt_at" FOR UPDATE SKIP LOCKED LIMIT ${Math.max(1, Math.min(limit, 25))}`);
      const claimed: Array<{ id: string; objectKey: string; lease: Date }> = [];
      for (const candidate of candidates) {
        const lease = new Date(now.getTime() + 300000);
        const taken = await tx.preProposalResponsePhotoUploadCandidate.updateMany({ where: { id: candidate.id, OR: [{ status: "PENDING" }, { status: "PROCESSING", leaseExpiresAt: { lte: now } }] }, data: { status: "PROCESSING", leaseExpiresAt: lease, attemptCount: { increment: 1 } } });
        if (taken.count) claimed.push({ ...candidate, lease });
      }
      return claimed;
    });
    for (const claim of claims) {
      const referenced = await this.prisma.preProposalResponsePhoto.findUnique({ where: { objectKey: claim.objectKey }, select: { id: true } });
      if (referenced) { await this.prisma.preProposalResponsePhotoUploadCandidate.deleteMany({ where: { id: claim.id, status: "PROCESSING", leaseExpiresAt: claim.lease } }); continue; }
      try { await this.storage.delete(claim.objectKey); await this.prisma.preProposalResponsePhotoUploadCandidate.updateMany({ where: { id: claim.id, status: "PROCESSING", leaseExpiresAt: claim.lease }, data: { status: "PENDING", nextAttemptAt: new Date(now.getTime() + 86400000), leaseExpiresAt: null, lastError: null } }); }
      catch { await this.prisma.preProposalResponsePhotoUploadCandidate.updateMany({ where: { id: claim.id, status: "PROCESSING", leaseExpiresAt: claim.lease }, data: { status: "PENDING", nextAttemptAt: new Date(now.getTime() + 60000), leaseExpiresAt: null, lastError: "STORAGE_DELETE_FAILED" } }); }
    }
  }
}
