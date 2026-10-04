import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly jwtService: JwtService,
	) {}

	async login(loginDto: LoginDto) {
		const user = await this.prisma.user.findUnique({
			where: { email: loginDto.email },
			select: {
				id: true,
				email: true,
				passwordHash: true,
				role: true,
			},
		});

		if (!user || !(await compare(loginDto.password, user.passwordHash))) {
			throw new UnauthorizedException('Invalid email or password');
		}

		const accessToken = await this.jwtService.signAsync({
			sub: String(user.id),
			email: user.email,
			role: user.role,
		});

		return {
			accessToken,
			user: {
				id: user.id,
				email: user.email,
				role: user.role,
			},
		};
	}
}
