// backend/src/utils/jwt.ts
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface UserTokenPayload {
  uid: number;
  role: string;
  type: 'access' | 'refresh';
}

export interface DeviceTokenPayload {
  did: number;
  device_uid: string;
  type: 'device';
}

export const userJwt = {
  sign(payload: Omit<UserTokenPayload, 'type'>, type: 'access' | 'refresh') {
    const ttl = type === 'access' ? env.JWT_ACCESS_TTL : env.JWT_REFRESH_TTL;
    return jwt.sign({ ...payload, type }, env.JWT_SECRET, { expiresIn: ttl } as jwt.SignOptions);
  },
  verify(token: string) {
    return jwt.verify(token, env.JWT_SECRET) as UserTokenPayload;
  },
};

export const deviceJwt = {
  sign(payload: Omit<DeviceTokenPayload, 'type'>) {
    return jwt.sign(
      { ...payload, type: 'device' },
      env.JWT_DEVICE_SECRET,
      { expiresIn: env.JWT_DEVICE_TTL } as jwt.SignOptions
    );
  },
  verify(token: string) {
    return jwt.verify(token, env.JWT_DEVICE_SECRET) as DeviceTokenPayload;
  },
};
