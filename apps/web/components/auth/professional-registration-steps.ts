export function canContinueProfessionalRegistrationContacts(user: { emailVerified: boolean; phoneVerified: boolean }): boolean {
  return user.emailVerified && user.phoneVerified;
}
