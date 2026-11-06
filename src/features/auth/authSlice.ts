import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../../types/api';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  rememberMe: boolean;
}

const readStoredUser = (): { user: User | null; rememberMe: boolean } => {
  try {
    const localUser = localStorage.getItem('user');
    if (localUser) return { user: JSON.parse(localUser) as User, rememberMe: true };
    const sessionUser = sessionStorage.getItem('user');
    return sessionUser
      ? { user: JSON.parse(sessionUser) as User, rememberMe: false }
      : { user: null, rememberMe: true };
  } catch {
    return { user: null, rememberMe: true };
  }
};

const initialAuth = readStoredUser();

const initialState: AuthState = {
  user: initialAuth.user,
  isAuthenticated: Boolean(initialAuth.user),
  rememberMe: initialAuth.rememberMe,
};

function clearStoredAuth() {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem('user');
    storage.removeItem('token');
    storage.removeItem('refreshToken');
  }
}

function getUserStorage(): Storage {
  return sessionStorage.getItem('user') && !localStorage.getItem('user')
    ? sessionStorage
    : localStorage;
}

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{
        user: User;
        token?: string;
        accessToken?: string;
        refreshToken?: string;
        rememberMe?: boolean;
      }>
    ) => {
      const { user, token, accessToken, refreshToken, rememberMe = true } = action.payload;
      state.user = user;
      state.isAuthenticated = true;
      state.rememberMe = rememberMe;

      try {
        clearStoredAuth();
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('user', JSON.stringify(user));
        const effectiveToken = accessToken || token;
        if (effectiveToken) storage.setItem('token', effectiveToken);
        if (refreshToken) storage.setItem('refreshToken', refreshToken);
      } catch (e) {
        console.error('Failed to save authentication state', e);
      }
    },
    updateCurrentUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        try {
          getUserStorage().setItem('user', JSON.stringify(state.user));
        } catch (e) {
          console.error('Failed to update stored user', e);
        }
      }
    },
    logOut: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.rememberMe = true;
      clearStoredAuth();
    },
  },
});

export const { setCredentials, updateCurrentUser, logOut } = authSlice.actions;
export default authSlice.reducer;
