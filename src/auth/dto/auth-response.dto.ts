import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/enums/user-role.enum';

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  user!: {
    id: string;
    email: string;
    role: UserRole;
  };
}
