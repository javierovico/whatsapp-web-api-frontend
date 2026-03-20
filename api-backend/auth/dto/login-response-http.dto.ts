export interface LoginResponseHttpDto {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  userId: string;
  username: string | null;
}
