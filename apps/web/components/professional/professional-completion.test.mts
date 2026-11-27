import test from "node:test";
import assert from "node:assert/strict";
import { getProfessionalCompletion } from "./professional-completion.ts";

const base = { professionalRegistrationCompleted: false, emailVerified: false, phoneVerified: false, professionalProfile: { verificationStatus: "NOT_STARTED" } };

test("orienta primeiro o envio de identidade sem confundir envio com aprovação", () => {
  const result = getProfessionalCompletion(base);
  assert.equal(result.completed, 1);
  assert.equal(result.next?.href, "/cadastro/profissional/identidade");
});
test("depois dos documentos, orienta a confirmação dos dois contatos", () => {
  const result = getProfessionalCompletion({ ...base, professionalRegistrationCompleted: true, emailVerified: true });
  assert.equal(result.completed, 2);
  assert.equal(result.next?.href, "/cadastro/profissional/contatos");
});
test("perfil rejeitado deve ser revisto e reenviado", () => {
  const result = getProfessionalCompletion({ professionalRegistrationCompleted: true, emailVerified: true, phoneVerified: true, professionalProfile: { verificationStatus: "REJECTED" } });
  assert.equal(result.completed, 3);
  assert.match(result.next!.label, /reenviar/);
});
test("perfil em análise não é apresentado como aprovado", () => {
  const result = getProfessionalCompletion({ professionalRegistrationCompleted: true, emailVerified: true, phoneVerified: true, professionalProfile: { verificationStatus: "PENDING" } });
  assert.equal(result.completed, 4);
  assert.equal(result.next, null);
});
