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
		return {
			...user,
			accessToken,
		};
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
		const nodeEnv = this.config.get<string>('NODE_ENV');
		const explicitSecure = this.config.get<string>('COOKIE_SECURE');
		const explicitSameSite = this.config.get<string>('COOKIE_SAME_SITE');
		const frontendUrl =
			this.config.get<string>('FRONTEND_URLS') ??
			this.config.get<string>('FRONTEND_URL') ??
			'';

		const usesHttpsFrontend = frontendUrl
			.split(',')
			.some((u) => u.trim().startsWith('https://'));
		const isProductionLike =
			nodeEnv === 'production' ||
			!!this.config.get<string>('RENDER') ||
			usesHttpsFrontend;

		const secure =
			explicitSecure !== undefined
				? explicitSecure === 'true'
				: isProductionLike;

		const sameSite: CookieOptions['sameSite'] = explicitSameSite
			? (explicitSameSite as CookieOptions['sameSite'])
			: secure
				? 'none'
				: 'lax';

		return {
			httpOnly: true,
			secure,
			sameSite,
			path: '/',
		};
	}
}
