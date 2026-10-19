import { Injectable } from '@angular/core';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { TasksResponse } from '../models/workshop.models';

@Injectable({ providedIn: 'root' })
export class TasksService {
  async list(owner: string, token: string): Promise<TasksResponse> {
    const response = await axios.get<TasksResponse>(environment.tasksUrl + '?owner=' + owner, {
      headers: { Authorization: 'Bearer ' + token }
    });
    return response.data;
  }
}