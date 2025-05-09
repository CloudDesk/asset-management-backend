import { Pool } from "pg";
import { QueryResult } from "pg";
import { ErrorHandler } from "../errorHandler/errorHandler.js";
import { sendMail } from "../Gmail/gmail.js";
import dataTypeCheck from "../utils/Datatype/checkDatatype.js";
import { hashGenerate, hashValidator } from "../utils/hashing/hashing.js";
import { v4 as uuidv4 } from 'uuid';
import { saveSession } from "./session.service.js";
import { REDIRECT_INVENTORY_URL } from "../config/config.js";
import { getOtp, saveOtp } from "./otp.service.js";
import { 
    UserServiceResponse,
    UserServiceResult,
    UserQueryParams,
    UserData,
    UserLoginResponse
} from "../interfaces/user.interface.js";
import pool from "../database/postgres.js";

let generatedotp;

export class UserService {
    constructor(private readonly db: Pool = pool) {}

    /**
     * Get all users with pagination and filtering
     */
    public async getUsersData(request: { query: UserQueryParams }): Promise<UserServiceResult> {
        try {
            const { pageNumber, recordCount, whereClauses, queryParams } = this.buildQueryParameters(request.query);
            const whereClause = whereClauses.length > 0 
                ? `WHERE ${whereClauses.join(" AND ")}` 
                : '';
            
            const offset = (pageNumber - 1) * recordCount;
            let queryText = `SELECT * FROM users ${whereClause}`;
            
            if (pageNumber && recordCount) {
                queryText += ` OFFSET $${queryParams.length + 1} LIMIT $${queryParams.length + 2}`;
                queryParams.push(offset, recordCount);
            }

            const result = await this.db.query(queryText, queryParams);
            return {
                command: 'SELECT',
                data: result.rows
            };
        } catch (error) {
            console.error("Query Execution Error: IN getUsersData", error);
            return {
                command: 'Fail',
                message: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    /**
     * Handle forgot password request
     */
    public async forgotuser(request: { body: UserData }): Promise<UserLoginResponse> {
        try {
            const { email } = request.body;
            const result = await this.db.query(
                `SELECT * FROM users WHERE email = $1`,
                [email]
            );

            if (result.rows.length === 0) {
                return {
                    status: 'error',
                    Message: 'User not found',
                    userdata: { error: 'User not found' }
                };
            }

            // Add your password reset logic here
            return {
                status: 'success',
                userdata: result.rows[0]
            };
        } catch (error) {
            console.error("Query Execution Error: IN forgotuser", error);
            return {
                status: 'error',
                Message: error instanceof Error ? error.message : 'Unknown error occurred',
                userdata: { error: 'Failed to process request' }
            };
        }
    }

    /**
     * Get logged in user data
     */
    public async getLoggedInUsersData(request: any, reply: any): Promise<UserLoginResponse> {
        console.log("getLoggedInUsersData", request.params)
        try {
            const ecomQuery = `SELECT * FROM users WHERE LOWER(useremail) = LOWER($1)`;
            const ecomResult = await this.db.query(ecomQuery, [request.params.useremail]);
            if (ecomResult.rows.length > 0) {
                let validatePassword = await hashValidator(
                    request.params.userpassword,
                    ecomResult.rows[0].userpassword
                );

                if (validatePassword) {
                    const sessionId = uuidv4();
                    const sessionData = {
                        useremail: request.params.useremail,
                        userpassword: request.params.userpassword
                    };
                    let sessionSaved = await saveSession(sessionId, sessionData);

                    if (sessionSaved) {
                        return { sessionId, userdata: ecomResult.rows };
                    } else {
                        return { userdata: { error: 'Please Contact Admin. You are Not Authorized to Login' } };
                    }
                } else {
                    return { userdata: { error: 'User Credentials are wrong. Please try again' } };
                }
            } else {
                console.log("else")
                const inventoryQuery = `SELECT * FROM inventoryusers WHERE useremail = $1`;
                const inventoryResult = await this.db.query(inventoryQuery, [request.params.useremail]);

                if (inventoryResult.rows.length > 0) {
                    let validatePassword = await hashValidator(
                        request.params.userpassword,
                        inventoryResult.rows[0].userpassword
                    );
                    if (validatePassword) {
                        const sessionId = uuidv4();
                        const sessionData = {
                            firstname: inventoryResult.rows[0].firstname,
                            id: inventoryResult.rows[0].id,
                            lastname: inventoryResult.rows[0].lastname,
                            location: inventoryResult.rows[0].location,
                            role: inventoryResult.rows[0].role,
                            useremail: inventoryResult.rows[0].useremail,
                            userpassword: inventoryResult.rows[0].userpassword,
                            usersphonenumber: inventoryResult.rows[0].usersphonenumber
                        };
                        let sessionSaved = await saveSession(sessionId, sessionData);

                        if (sessionSaved) {
                            return {
                                sessionId, userdata: inventoryResult.rows,
                                redirect: true,
                                inventoryAppUrl: `${REDIRECT_INVENTORY_URL}?sessionId=${sessionId}`
                            };
                        } else {
                            return { userdata: { error: 'Please Contact Admin. You are Not Authorized to Login' } };
                        }
                    }
                    else {
                        return { userdata: { error: 'User Credentials are wrong. Please try again' } };
                    }
                } else {
                    return { userdata: { error: 'No Users Found With this Email ID. Please Sign up' } };
                }
            }
        } catch (error) {
            console.error("Query Execution Error: IN getLoggedInUsersData", error);
            throw error;
        }
    }

    /**
     * Delete user by ID
     */
    public async deleteUser(id: number): Promise<UserServiceResponse> {
        try {
            const result = await this.db.query(
                `DELETE FROM users WHERE id = $1`,
                [id]
            );
            return {
                command: 'DELETE',
                message: result.rowCount !== 0 
                    ? 'User deleted successfully' 
                    : `User not found with id ${id}`
            };
        } catch (error) {
            console.error("Query Execution Error: IN deleteUser", error);
            return {
                command: 'Fail',
                message: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    /**
     * Create or update user
     */
    public async upsertUser(userData: UserData): Promise<UserServiceResponse> {
        try {
            const { id, ...upsertFields } = userData;
            const fieldNames = Object.keys(upsertFields);
            const fieldValues = Object.values(upsertFields);

            let queryText: string;
            let params: any[];

            if (id) {
                queryText = `UPDATE users SET ${fieldNames
                    .map((field, index) => `${field} = $${index + 1}`)
                    .join(", ")} WHERE id = $${fieldNames.length + 1} RETURNING *`;
                params = [...fieldValues, id];
            } else {
                queryText = `INSERT INTO users (${fieldNames.join(", ")}) 
                    VALUES (${fieldNames.map((_, index) => `$${index + 1}`).join(", ")}) 
                    RETURNING *`;
                params = fieldValues;
            }

            const result = await this.db.query(queryText, params);
            return {
                command: id ? 'UPDATE' : 'INSERT',
                data: result.rows[0]
            };
        } catch (error) {
            console.error("Query Execution Error: IN upsertUser", error);
            return {
                command: 'Fail',
                message: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    /**
     * Handle user logout
     */
    public async userlogout(request: any, reply: any): Promise<void> {
        try {
            const sessionId = request.cookies.sessionId;
            if (sessionId) {
                await this.db.query(
                    `UPDATE users SET sessionid = NULL WHERE sessionid = $1`,
                    [sessionId]
                );
                reply.clearCookie('sessionId');
            }
        } catch (error) {
            console.error("Query Execution Error: IN userlogout", error);
            throw error;
        }
    }

    /**
     * Update user FCM ID
     */
    public async upsertFcmidUser(userData: UserData): Promise<UserServiceResponse> {
        try {
            const { id, fcmid } = userData;
            if (!id || !fcmid) {
                return {
                    command: 'Fail',
                    message: 'Missing required fields'
                };
            }

            const result = await this.db.query(
                `UPDATE users SET fcmid = $1 WHERE id = $2 RETURNING *`,
                [fcmid, id]
            );

            return {
                command: result.rowCount !== 0 ? 'UPDATE' : 'INSERT',
                data: result.rows[0]
            };
        } catch (error) {
            console.error("Query Execution Error: IN upsertFcmidUser", error);
            return {
                command: 'Fail',
                message: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    // Private helper methods
    private buildQueryParameters(query: UserQueryParams) {
        const pageNumber = parseInt(query.page?.toString()) || 1;
        const recordCount = parseInt(query.count?.toString()) || 5000;
        const keys = Object.keys(query);
        const values = Object.values(query);

        let whereClauses: string[] = [];
        let parameterIndex = 1;
        const queryParams: any[] = [];

        keys.forEach((key, index) => {
            if (key === "page" || key === "count") return;

            const paramValues = Array.isArray(values[index]) ? values[index] : [values[index]];
            whereClauses.push(this.buildStandardClause(key, paramValues, queryParams, parameterIndex));
            parameterIndex += paramValues.length;
        });

        return { pageNumber, recordCount, whereClauses, queryParams };
    }

    private buildStandardClause(key: string, values: any[], params: any[], startIndex: number): string {
        const clauses = values.map((value, idx) => {
            if (value.startsWith("NOT ")) {
                const cleanValue = value.slice(4);
                params.push(cleanValue);
                return `${key} != $${startIndex + idx}`;
            } else if (value.toUpperCase() === 'NULL') {
                return `${key} IS NULL`;
            } else {
                params.push(value);
                return `${key} = $${startIndex + idx}`;
            }
        });
        return `(${clauses.join(" OR ")})`;
    }
}

// Create and export a singleton instance with proper dependency injection
export const userService = new UserService();
