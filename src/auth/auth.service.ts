import { ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuthDto } from './dto'
import * as argon from 'argon2'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class AuthService {
  constructor (
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService
  ) {}

  async signup (dto: AuthDto) {
    // hash password
    const hash = await argon.hash(dto.password)
    try {
      // create user
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          hash
        }
      })

      return this.signToken(user.id, user.email)
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ForbiddenException('Credentials taken')
        }
      }
      throw err
    }
  }

  async signin (dto: AuthDto) {
    // find user by email
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email
      }
    })

    // if user does not exist throw exception
    if (!user) throw new ForbiddenException('Credentials incorrect')

    // compare password
    const pwMatch = await argon.verify(user.hash, dto.password)

    // if password incorrect throw exception
    if (!pwMatch) throw new ForbiddenException('Credentials incorrect')

    return this.signToken(user.id, user.email)
  }

  async signToken (
    userId: number,
    email: string
  ): Promise<{access_token: string}> {
    const payload = {
      sub: userId,
      email
    }

    const secret = this.config.get('JWT_SECRET')

    const token = await this.jwt.signAsync(payload, {
      expiresIn: '60m',
      secret
    })

    return {
      access_token: token
    }
  }
}
