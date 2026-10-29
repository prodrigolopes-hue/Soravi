import { randomUUID } from "node:crypto";
import { Prisma, UserStatus } from "../generated/prisma/client";
import { createIntegrationPrismaService } from "./integration-database";
import { ProfessionalIdentityReviewService } from "../modules/users/professional-identity-review.service";

describe("concurrent identity decisions", () => {
  const control = createIntegrationPrismaService(), first = createIntegrationPrismaService(), second = createIntegrationPrismaService();
  const ids: string[] = [];
  beforeAll(async () => { await Promise.all([control.$connect(), first.$connect(), second.$connect()]); const [x] = await control.$queryRaw<{ current_database:string }[]>(Prisma.sql`SELECT current_database()`); if (x.current_database !== "soravi_integration_test") throw new Error("integration database only"); });
  afterEach(async () => { if (!ids.length) return; await control.identityVerificationEvidenceReference.deleteMany({ where: { attemptId: ids[3] } }); await control.identityVerificationDecision.deleteMany({ where: { attemptId: ids[3] } }); await control.professionalIdentityVerificationAttempt.deleteMany({ where:{ id:ids[3] } }); await control.personalIdentity.deleteMany({where:{id:ids[2]}}); await control.professionalProfile.deleteMany({where:{id:ids[1]}}); await control.user.deleteMany({where:{id:ids[0]}}); ids.length=0; });
  afterAll(async()=>Promise.all([control.$disconnect(),first.$disconnect(),second.$disconnect()]));
  it("allows exactly one manual decision", async () => {
    const u=randomUUID(), p=randomUUID(), i=randomUUID(), a=randomUUID(); ids.push(u,p,i,a); const email=`${u}@test.local`;
    await control.user.create({data:{id:u,name:"x",email,emailNormalized:email,passwordHash:"x",status:UserStatus.ACTIVE}}); await control.professionalProfile.create({data:{id:p,userId:u,displayName:"x"}}); await control.personalIdentity.create({data:{id:i,userId:u,cpfEnvelope:{},cpfHmac:randomUUID().replaceAll("-",""),hmacKeyId:"x"}}); await control.professionalIdentityVerificationAttempt.create({data:{id:a,professionalProfileId:p,personalIdentityId:i,status:"UNDER_REVIEW"}});
    const storage={createTemporaryReadUrl:jest.fn()}; const input={result:"CONFIRMED" as const,reasonCode:"MATCH",criteriaVersion:"v1"};
    const results=await Promise.allSettled([new ProfessionalIdentityReviewService(first,storage as never).decide(u,a,input),new ProfessionalIdentityReviewService(second,storage as never).decide(u,a,input)]);
    expect(results.filter(x=>x.status==="fulfilled")).toHaveLength(1); expect(await control.identityVerificationDecision.count({where:{attemptId:a}})).toBe(1);
  });
});
