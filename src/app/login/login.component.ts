import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Preferences } from '../models/workshop.models';
import { AuthService } from '../services/auth.service';
import { PreferencesService } from '../services/preferences.service';
import { SessionService } from '../services/session.service';
import { httpErrorMessage } from '../utils/http-error';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username = '';
  password = '';
  busy = false;
  message = '';
  messageDetail = '';
  preferences: Preferences;

  constructor(
    private router: Router,
    private auth: AuthService,
    private session: SessionService,
    private preferenceStore: PreferencesService
  ) {
    this.preferences = this.preferenceStore.load();
  }

  async login(): Promise<void> {
    this.message = '';
    this.messageDetail = '';
    if (isBlank(this.username)) {
      this.message = 'Ingrese un usuario.';
      return;
    }
    if (isBlank(this.password)) {
      this.message = 'Ingrese una contraseña.';
      return;
    }
    this.busy = true;
    try {
      const response = await this.auth.login(this.username, this.password);
      if (!response?.token) {
        this.message = 'El backend respondió sin token.';
        return;
      }
      this.session.save(response.token, response.user);
      this.preferenceStore.save(this.preferences);
      await this.router.navigate(['/dashboard']);
    } catch (error: unknown) {
      this.message = 'No se pudo autenticar a ' + this.username + '.';
      this.messageDetail = httpErrorMessage(error, 'message', 'Error desconocido');
      console.error(error);
    } finally {
      this.busy = false;
    }
  }
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === '';
}
