import { Injectable } from '@angular/core';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { LoginRequest, LoginResponse } from '../models/workshop.models';

const LOGIN_TIMEOUT_MS = 5000;
const CLIENT_ID = 'angular-workshop';

@Injectable({ providedIn: 'root' })
export class AuthService {
  async login(username: string, password: string): Promise<LoginResponse | undefined> {
    const request: LoginRequest = { username, password, client: CLIENT_ID };
    const response = await axios.post<LoginResponse>(environment.authUrl, request, { timeout: LOGIN_TIMEOUT_MS });
    return response?.data;
  }
}