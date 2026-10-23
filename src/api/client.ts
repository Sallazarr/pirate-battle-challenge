import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/', // O MSW vai intercetar as chamadas feitas para a raiz
  headers: {
    'Content-Type': 'application/json',
  },
});