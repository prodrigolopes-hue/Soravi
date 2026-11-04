import { HeadBucketCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";

import { Prisma, UserStatus } from "../generated/prisma/client";
import { PrismaService } from "../database/prisma.service";
import { ProfessionalIdentityEvidenceDisposalService } from "../modules/users/professional-identity-evidence-disposal.service";
import { S3StorageService } from "../storage/s3-storage.service";

const ENABLED = process.env.RUN_R2_PHYSICAL_DISPOSAL_TEST === "true";
const TEST_DATABASE = "soravi_disposal_physical_test";
const TEST_BUCKET = "soravi-identity-disposal-physical-test";

// This suite is intentionally opt-in: without the exact value "true", it must not connect to PostgreSQL or R2.
(ENABLED ? describe : describe.skip)("physical R2 identity evidence disposal", () => {
  let prisma: PrismaService;
  let client: S3Client;
  let storage: S3StorageService;
  let objectKey: string | undefined;
  const createdUserIds = new Set<string>();
  const createdProfileIds = new Set<string>();
  const createdIdentityIds = new Set<string>();
  const createdAttemptIds = new Set<string>();
  const createdEvidenceIds = new Set<string>();

  beforeAll(async () => {
    const configuration = readConfiguration();
    client = new S3Client({ endpoint: configuration.endpoint, region: "auto", credentials: { accessKeyId: configuration.accessKeyId, secretAccessKey: configuration.secretAccessKey } });
    storage = new S3StorageService(client, new ConfigService({ STORAGE_S3_BUCKET: configuration.bucket }));
    prisma = new PrismaService(new ConfigService({ DATABASE_URL: configuration.databaseUrl }));

    await assertHeadBucket(configuration.bucket);
    await prisma.$connect();
    const [database] = await prisma.$queryRaw<Array<{ current_database: string }>>(Prisma.sql`SELECT current_database()`);
    if (database?.current_database !== TEST_DATABASE) throw new Error("Physical disposal test refused a database other than the dedicated test database.");
    const [evidenceCount, taskCount] = await Promise.all([prisma.identityVerificationEvidenceReference.count(), prisma.identityEvidenceDisposalTask.count()]);
    if (evidenceCount !== 0 || taskCount !== 0) throw new Error("Physical disposal test requires empty identity evidence and disposal task tables.");
  });

  afterEach(async () => {
    if (objectKey) await storage.delete(objectKey);
    if (createdEvidenceIds.size) await prisma.identityEvidenceDisposalTask.deleteMany({ where: { evidenceId: { in: [...createdEvidenceIds] } } });
    if (createdEvidenceIds.size) await prisma.identityVerificationEvidenceReference.deleteMany({ where: { id: { in: [...createdEvidenceIds] } } });
    if (createdAttemptIds.size) await prisma.professionalIdentityVerificationAttempt.deleteMany({ where: { id: { in: [...createdAttemptIds] } } });
    if (createdIdentityIds.size) await prisma.personalIdentity.deleteMany({ where: { id: { in: [...createdIdentityIds] } } });
    if (createdProfileIds.size) await prisma.professionalProfile.deleteMany({ where: { id: { in: [...createdProfileIds] } } });
    if (createdUserIds.size) await prisma.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });
    objectKey = undefined;
    createdUserIds.clear(); createdProfileIds.clear(); createdIdentityIds.clear(); createdAttemptIds.clear(); createdEvidenceIds.clear();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    client?.destroy();
  });

  it("physically removes one synthetic object and records completed disposal", async () => {
    const now = new Date("2026-11-03T12:00:00.000Z");
    const fixture = await createEligibleFixture(now);
    objectKey = fixture.objectKey;
    await storage.upload({ body: Uint8Array.of(1, 2, 3, 4), contentType: "application/octet-stream", sizeBytes: 4, objectKey: fixture.objectKey });
    await expectObjectExists(fixture.objectKey);

    const disposal = new ProfessionalIdentityEvidenceDisposalService(prisma, storage, new ConfigService({ IDENTITY_EVIDENCE_DISPOSAL_ENABLED: "true" }));
    await disposal.processBatch(now, 1);

    await expectObjectMissing(fixture.objectKey);
    objectKey = undefined;
    const task = await prisma.identityEvidenceDisposalTask.findUniqueOrThrow({ where: { evidenceId: fixture.evidenceId }, select: { id: true, status: true, completedAt: true, lastError: true } });
    const evidence = await prisma.identityVerificationEvidenceReference.findUniqueOrThrow({ where: { id: fixture.evidenceId }, select: { reference: true, discardedAt: true } });
    expect(task).toMatchObject({ status: "COMPLETED", completedAt: now, lastError: null });
    expect(evidence).toMatchObject({ reference: null, discardedAt: now });
  });

  async function createEligibleFixture(now: Date) {
    const userId = randomUUID(), profileId = randomUUID(), identityId = randomUUID(), attemptId = randomUUID(), evidenceId = randomUUID();
    const key = `integration/identity-disposal-physical/${randomUUID()}/synthetic.bin`;
    const email = `r2-physical-${userId}@example.test`;
    createdUserIds.add(userId); createdProfileIds.add(profileId); createdIdentityIds.add(identityId); createdAttemptIds.add(attemptId); createdEvidenceIds.add(evidenceId);
    await prisma.user.create({ data: { id: userId, name: "R2 physical disposal test", email, emailNormalized: email, passwordHash: "integration", status: UserStatus.ACTIVE } });
    await prisma.professionalProfile.create({ data: { id: profileId, userId, displayName: "R2 physical disposal test" } });
    await prisma.personalIdentity.create({ data: { id: identityId, userId, cpfEnvelope: { synthetic: true }, cpfHmac: randomUUID().replaceAll("-", ""), hmacKeyId: "physical-test" } });
    await prisma.professionalIdentityVerificationAttempt.create({ data: { id: attemptId, professionalProfileId: profileId, personalIdentityId: identityId } });
    await prisma.identityVerificationEvidenceReference.create({ data: { id: evidenceId, attemptId, kind: "DOCUMENT", reference: key, supersededAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), createdAt: now } });
    return { evidenceId, objectKey: key };
  }

  async function expectObjectExists(key: string): Promise<void> {
    await client.send(new HeadObjectCommand({ Bucket: TEST_BUCKET, Key: key }));
  }

  async function assertHeadBucket(bucket: string): Promise<void> {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error: unknown) {
      throw new Error(`HEAD_BUCKET failed: ${safeErrorDetails(error)}`);
    }
  }

  async function expectObjectMissing(key: string): Promise<void> {
    try {
      await client.send(new HeadObjectCommand({ Bucket: TEST_BUCKET, Key: key }));
    } catch (error: unknown) {
      if (isExplicitObjectMissing(error)) return;
      throw error;
    }
    throw new Error("Physical disposal test expected the synthetic object to be absent.");
  }
});

function readConfiguration(): { databaseUrl: string; endpoint: string; accessKeyId: string; secretAccessKey: string; bucket: string } {
  const databaseUrl = required("DISPOSAL_PHYSICAL_TEST_DATABASE_URL");
  const endpoint = required("R2_PHYSICAL_TEST_ENDPOINT");
  const accessKeyId = required("R2_PHYSICAL_TEST_ACCESS_KEY_ID");
  const secretAccessKey = required("R2_PHYSICAL_TEST_SECRET_ACCESS_KEY");
  const bucket = required("R2_PHYSICAL_TEST_BUCKET");
  const database = new URL(databaseUrl);
  if (database.protocol !== "postgresql:" || !["localhost", "127.0.0.1"].includes(database.hostname) || database.port !== "5432" || decodeURIComponent(database.pathname) !== `/${TEST_DATABASE}`) throw new Error("DISPOSAL_PHYSICAL_TEST_DATABASE_URL must target the dedicated local physical-test database.");
  const parsedEndpoint = new URL(endpoint);
  if (parsedEndpoint.protocol !== "https:" || !parsedEndpoint.hostname.endsWith(".r2.cloudflarestorage.com") || parsedEndpoint.pathname !== "/" || parsedEndpoint.search || parsedEndpoint.hash || parsedEndpoint.username || parsedEndpoint.password) throw new Error("R2_PHYSICAL_TEST_ENDPOINT must be a bucketless Cloudflare R2 S3 HTTPS endpoint without query or fragment.");
  if (bucket !== TEST_BUCKET) throw new Error("R2_PHYSICAL_TEST_BUCKET must be the dedicated physical-test bucket.");
  return { databaseUrl, endpoint, accessKeyId, secretAccessKey, bucket };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the opted-in physical disposal test.`);
  return value;
}

function isExplicitObjectMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { name?: unknown; Code?: unknown; code?: unknown; $metadata?: { httpStatusCode?: unknown } };
  const code = candidate.Code ?? candidate.code ?? candidate.name;
  return candidate.$metadata?.httpStatusCode === 404 && (code === "NotFound" || code === "NoSuchKey" || code === "NotFoundError");
}

function safeErrorDetails(error: unknown): string {
  if (typeof error !== "object" || error === null) return "name=UnknownError code=unknown httpStatus=unknown";
  const candidate = error as { name?: unknown; Code?: unknown; code?: unknown; $metadata?: { httpStatusCode?: unknown } };
  const name = typeof candidate.name === "string" ? candidate.name : "UnknownError";
  const code = typeof candidate.Code === "string" ? candidate.Code : typeof candidate.code === "string" ? candidate.code : "unknown";
  const httpStatus = typeof candidate.$metadata?.httpStatusCode === "number" ? String(candidate.$metadata.httpStatusCode) : "unknown";
  return `name=${name} code=${code} httpStatus=${httpStatus}`;
}
