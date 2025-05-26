import { FastifyRequest, FastifyReply } from "fastify";
import { UserService } from "../services/user.service.js";
import { 
  User, 
  UserQueryParams, 
  UserLoginParams, 
  UserForgotPasswordRequest,
  UserControllerResponse 
} from "../interfaces/user.interface.js";

interface FastifyReplyWithCookie extends FastifyReply {
  clearCookie: (name: string, options?: any) => void;
}

export class UserController {
  public static async getUsersData(
    request: FastifyRequest<{ Querystring: UserQueryParams }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const result = await UserService.getUsersData(request);
      reply.send(result);
    } catch (error) {
      console.error("Error in getUsersData", error);
      reply.status(500).send({ error: error.message });
    }
  }

  public static async forgotPassword(
    request: FastifyRequest<{ Body: UserForgotPasswordRequest }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const result = await UserService.forgotPassword(request.body);
      if (result.status === 'success') {
        reply.send(result);
      } else {
        reply.status(404).send({ message: result.message });
      }
    } catch (error) {
      console.error("Error in forgotPassword", error);
      reply.status(500).send({ error: error.message });
    }
  }

  public static async login(
    request: FastifyRequest<{ Body: UserLoginParams }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const result = await UserService.login(request.body);
      if (result.userdata && !Array.isArray(result.userdata)) {
        reply.status(401).send({ error: result.message });
      } else {
        reply.send(result);
      }
    } catch (error) {
      console.error("Error in login", error);
      reply.status(500).send({ error: error.message });
    }
  }

  public static async deleteUser(
    request: FastifyRequest<{ Params: { id: number } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const result = await UserService.deleteUser(request.params.id);
      reply.send(result);
    } catch (error) {
      console.error("Error in deleteUser", error);
      reply.status(500).send({ error: error.message });
    }
  }

  public static async upsertUser(
    request: FastifyRequest<{ Body: User }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const result = await UserService.upsertUser(request.body);
      if (result.command === 'UPDATE') {
        reply.status(200).send('User Updated successfully');
      } else if (result.command === 'INSERT') {
        reply.status(200).send('User signup done successfully');
      } else {
        reply.status(401).send({ message: result.message });
      }
    } catch (error) {
      console.error("Error in upsertUser", error);
      reply.status(500).send({ error: error.message });
    }
  }

  public static async logout(
    request: FastifyRequest,
    reply: FastifyReplyWithCookie
  ): Promise<void> {
    try {
      const result = await UserService.logout();
      reply.clearCookie('sessionId', {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Strict'
      });
      reply.status(200).send(result);
    } catch (error) {
      console.error("Error in logout", error);
      reply.status(500).send({ error: error.message });
    }
  }
}
