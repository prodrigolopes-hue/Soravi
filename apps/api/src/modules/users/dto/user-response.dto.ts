import {
  ProfessionalVerificationStatus,
  Role,
  UserStatus,
} from "../../../generated/prisma/client";

export interface CustomerProfileSummary {
  id: string;
}

export interface ProfessionalProfileSummary {
  id: string;
  displayName: string;
  verificationStatus: ProfessionalVerificationStatus;
  isAvailable: boolean;
}

interface UserResponseDtoProperties {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  roles: Role[];
  emailVerified: boolean;
  phoneVerified: boolean;
  customerProfile: CustomerProfileSummary | null;
  professionalProfile: ProfessionalProfileSummary | null;
  createdAt: Date;
}

export class UserResponseDto {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly status: UserStatus;
  readonly roles: Role[];
  readonly emailVerified: boolean;
  readonly phoneVerified: boolean;
  readonly customerProfile: CustomerProfileSummary | null;
  readonly professionalProfile: ProfessionalProfileSummary | null;
  readonly createdAt: Date;

  constructor(properties: UserResponseDtoProperties) {
    this.id = properties.id;
    this.name = properties.name;
    this.email = properties.email;
    this.phone = properties.phone;
    this.status = properties.status;
    this.roles = properties.roles;
    this.emailVerified = properties.emailVerified;
    this.phoneVerified = properties.phoneVerified;
    this.customerProfile = properties.customerProfile;
    this.professionalProfile = properties.professionalProfile;
    this.createdAt = properties.createdAt;
  }
}