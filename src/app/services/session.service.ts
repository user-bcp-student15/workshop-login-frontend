import { Injectable } from '@angular/core';
import { WorkshopUser } from '../models/workshop.models';

const LEGACY_TOKEN_KEY = 'workshop_token';
const USER_KEY = 'workshop_user';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private activeToken: string | null = null;

  constructor() {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  }

  token(): string | null {
    return this.activeToken;
  }

  user(): WorkshopUser {
    return JSON.parse(localStorage.getItem(USER_KEY) || '{}');
  }

  save(token: string, user: WorkshopUser | undefined): void {
    this.activeToken = token;
    localStorage.setItem(USER_KEY, String(JSON.stringify(user)));
  }

  clear(): void {
    this.activeToken = null;
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}