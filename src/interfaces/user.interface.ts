export interface User {
  id?: number;
  firstname: string;
  lastname: string;
  useremail: string;
  userpassword: string;
  usermobilenumber?: string;
  fcmid?: string;
  createddate?: Date;
  modifieddate?: Date;
}

export interface UserQueryParams {
  page?: number;
  count?: number;
  useremail?: string;
  sortby?: string;
}

export interface UserLoginParams {
  useremail: string;
  userpassword: string;
}

export interface UserForgotPasswordRequest {
  useremail: string;
  otp?: string;
}

export interface UserResponse {
  id: number;
  firstname: string;
  lastname: string;
  useremail: string;
  usermobilenumber?: string;
  fcmid?: string;
  createddate: Date;
  modifieddate: Date;
}

export interface UserServiceResponse {
  rows?: UserResponse[];
  command?: string;
  message?: string;
  status?: string;
  sessionId?: string;
  userdata?: UserResponse[];
  redirect?: boolean;
  inventoryAppUrl?: string;
  data?: UserResponse[];
  errorMessage?: string;
  errorDetails?: any;
  statusCode?: number;
}

export interface UserControllerResponse {
  status: string;
  message?: string;
  data?: UserResponse | UserResponse[];
  sessionId?: string;
  userdata?: UserResponse[];
  redirect?: boolean;
  inventoryAppUrl?: string;
} 