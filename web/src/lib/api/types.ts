import type { components } from "./schema";

type Schemas = components["schemas"];

export type UserResponse = Schemas["UserResponse"];
export type Preferences = Schemas["Preferences"];
export type TokenPair = Schemas["TokenPair"];
export type AuthResponse = Schemas["AuthResponse"];
export type UpdateMeRequest = Schemas["UpdateMeRequest"];
export type ThemeName = Preferences["theme"];
export type LanguageCode = Preferences["language"];
