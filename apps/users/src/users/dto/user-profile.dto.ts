import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@salescart/common';

/** What a user (or the admin looking at their own profile) ever sees of themselves — never the password hash. */
export class UserProfileDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'asha@example.com' })
  email!: string;

  @ApiProperty({ example: 'Asha Rao' })
  name!: string;

  @ApiProperty({ example: '+91 90000 00000', nullable: true })
  phone!: string | null;

  @ApiProperty({ enum: Role, example: Role.CUSTOMER })
  role!: Role;

  @ApiProperty()
  createdAt!: Date;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: UserProfileDto })
  user!: UserProfileDto;
}
