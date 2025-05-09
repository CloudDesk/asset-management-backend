import { FastifyRequest } from 'fastify';

export interface UserParams {
    id: number;
}

export interface UserRequest extends FastifyRequest {
    params: UserParams;
    body: UserData;
}

export interface UserResponse {
    success: boolean;
    data?: any;
    error?: string;
}

export interface UserServiceResponse {
    command: 'INSERT' | 'UPDATE' | 'DELETE' | 'Fail' | 'SELECT';
    message?: string;
    data?: any;
    rows?: any[];
}

export interface UserData {
    id?: number;
    email?: string;
    password?: string;
    name?: string;
    fcmid?: string;
    sessionId?: string;
    useremail?: string;
    userpassword?: string;
    firstname?: string;
    lastname?: string;
    usermobilenumber?: string;
    [key: string]: any;
}

export interface UserQueryParams {
    page?: number;
    count?: number;
    [key: string]: any;
}

export interface UserLoginResponse {
    status?: string;
    Message?: string;
    userdata?: UserData | { error: string };
    sessionId?: string;
    redirect?: boolean;
    inventoryAppUrl?: string;
}

export interface UserErrorResponse {
    errorMessage: string;
    errorDetails: any;
    statusCode: number;
}

export type UserServiceResult = UserServiceResponse | UserLoginResponse | UserErrorResponse; 