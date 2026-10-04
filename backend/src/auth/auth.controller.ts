import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	Res,
	UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service';
import { ACCESS_TOKEN_COOKIE } from './auth.constants';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';

@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly config: ConfigService,
	) {}

	@Post('login')
	@HttpCode(HttpStatus.OK)
	async login(
		@Body() loginDto: LoginDto,
		@Res({ passthrough: true }) response: Response,
	) {
		const { accessToken, user } = await this.authService.login(loginDto);
		response.cookie(ACCESS_TOKEN_COOKIE, accessToken, this.cookieOptions());
		return user;
	}

	@Get('me')
	@UseGuards(JwtAuthGuard)
	getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
		return {
			id: user.id,
			email: user.email,
			role: user.role,
		};
	}

	@Post('logout')
	@HttpCode(HttpStatus.OK)
	logout(@Res({ passthrough: true }) response: Response) {
		response.clearCookie(ACCESS_TOKEN_COOKIE, this.cookieOptions());
		return { success: true };
	}

	private cookieOptions(): CookieOptions {
		const isProduction = this.config.get<string>('NODE_ENV') === 'production';
		return {
			httpOnly: true,
			secure: isProduction,
			sameSite: isProduction ? 'none' : 'lax',
			path: '/',
		};
	}
}
