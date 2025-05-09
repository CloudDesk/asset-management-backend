import { FastifyRequest, FastifyReply } from "fastify";
import { UserService, userService } from "../services/user.service.js";
import { 
    UserRequest, 
    UserResponse, 
    UserServiceResponse,
    UserServiceResult,
    UserQueryParams,
    UserData,
    UserLoginResponse
} from "../interfaces/user.interface.js";
import {
    sendSuccessResponse,
    sendErrorResponse,
    handleControllerError,
    isSuccessfulOperation,
    getOperationMessage,
    formatResponse
} from "../utils/controllerHelpers.js";

export class UserController {
    constructor(private readonly userService: UserService) {}

    /**
     * Get all users data
     */
    public async getUsersData(request: UserRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.userService.getUsersData(request);
            sendSuccessResponse(reply, result);
        } catch (error) {
            handleControllerError(error, reply, 'getUsersData');
        }
    }

    /**
     * Handle forgot password request
     */
    public async forgotuser(request: UserRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.userService.forgotuser(request);
            sendSuccessResponse(reply, result);
        } catch (error) {
            handleControllerError(error, reply, 'forgotuser');
        }
    }

    /**
     * Get logged in user data
     */
    public async getLoggedInUsersData(request: UserRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.userService.getLoggedInUsersData(request, reply);
            sendSuccessResponse(reply, result);
        } catch (error) {
            handleControllerError(error, reply, 'getLoggedInUsersData');
        }
    }

    /**
     * Delete user by ID
     */
    public async deleteUserData(request: UserRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.userService.deleteUser(request.params.id);
            if (isSuccessfulOperation(result)) {
                sendSuccessResponse(reply, formatResponse(null, 'User deleted successfully'));
            } else {
                const message = 'command' in result ? result.message : 'User not found';
                sendErrorResponse(reply, 404, message);
            }
        } catch (error) {
            handleControllerError(error, reply, 'deleteUserData');
        }
    }

    /**
     * Create or update user
     */
    public async upsertUser(request: UserRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.userService.upsertUser(request.body);
            if (isSuccessfulOperation(result)) {
                const message = 'command' in result ? getOperationMessage(result.command) : 'Operation successful';
                sendSuccessResponse(reply, formatResponse(result, message));
            } else {
                sendErrorResponse(reply, 400, 'Failed to create/update user');
            }
        } catch (error) {
            handleControllerError(error, reply, 'upsertUser');
        }
    }

    /**
     * Handle user logout
     */
    public async userlogout(request: UserRequest, reply: FastifyReply): Promise<void> {
        try {
            await this.userService.userlogout(request, reply);
            sendSuccessResponse(reply, formatResponse(null, 'Logged out successfully'));
        } catch (error) {
            handleControllerError(error, reply, 'userlogout');
        }
    }

    /**
     * Update user FCM ID
     */
    public async upsertFcmidUser(request: UserRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.userService.upsertFcmidUser(request.body);
            if (isSuccessfulOperation(result)) {
                sendSuccessResponse(reply, formatResponse(result, 'FCM ID updated successfully'));
            } else {
                sendErrorResponse(reply, 400, 'Failed to update FCM ID');
            }
        } catch (error) {
            handleControllerError(error, reply, 'upsertFcmidUser');
        }
    }
}

// Create and export a singleton instance with proper dependency injection
export const userController = new UserController(userService);

