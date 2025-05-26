import { query } from "../database/postgres.js";
import { ErrorHandler } from "../errorHandler/errorHandler.js";
import { sendMail } from "../Gmail/gmail.js";
import dataTypeCheck from "../utils/Datatype/checkDatatype.js";
import { hashGenerate, hashValidator } from "../utils/hashing/hashing.js";
import { v4 as uuidv4 } from 'uuid';
import { saveSession } from "./session.service.js";
import { REDIRECT_INVENTORY_URL } from "../config/config.js";
import { getOtp, saveOtp } from "./otp.service.js";
import { QueryBuilder } from "../utils/QueryBuilder.js";
import { 
  User, 
  UserQueryParams, 
  UserLoginParams, 
  UserForgotPasswordRequest,
  UserServiceResponse 
} from "../interfaces/user.interface.js";

export class UserService {
  private static readonly DEFAULT_PAGE_SIZE = 5000;
  private static readonly DEFAULT_PAGE_NUMBER = 1;
  private static readonly TABLE_NAME = 'users';

  public static async getUsersData(request: { query: UserQueryParams }): Promise<UserServiceResponse> {
    try {
      const pageNumber = parseInt(request.query.page?.toString()) || this.DEFAULT_PAGE_NUMBER;
      const recordCount = parseInt(request.query.count?.toString()) || this.DEFAULT_PAGE_SIZE;
      
      const queryBuilder = new QueryBuilder(this.TABLE_NAME);
      queryBuilder.buildWhereClause(request.query);
      const { query: queryText, params: queryParams } = queryBuilder.buildQuery(pageNumber, recordCount);

      const result = await query(queryText, queryParams);
      const datatypeCheckResult = await dataTypeCheck(result);
      return { rows: datatypeCheckResult };
    } catch (error) {
      console.error("Query Execution Error: IN getUsersData", error);
      const errorMessage = await ErrorHandler.handleQueryError(error);
      return errorMessage;
    }
  }

  public static async forgotPassword(request: UserForgotPasswordRequest): Promise<UserServiceResponse> {
    try {
      if (!request.otp) {
        const generatedotp = Math.floor(1000 + Math.random() * 9000);
        const emailData = {
          subject: "OTP Verification Code",
          text: `Your otp code to Reset Password For Revo Site is ${generatedotp}`,
          to: request.useremail
        };

        const otpsave = await saveOtp(request.useremail, generatedotp);
        const finduser = await this.getUsersData({ query: { useremail: request.useremail } });

        if (finduser.rows && finduser.rows.length > 0) {
          await sendMail(emailData, generatedotp);
          return { status: "success", message: "OTP sent Successfully" };
        } else {
          return {
            status: "failure",
            message: "Entered User Email Is wrong. Please Enter correct Email to Reset Password"
          };
        }
      } else {
        const finduser = await this.getUsersData({ query: { useremail: request.useremail } });
        const optmatch = await getOtp(request.useremail, request.otp);
        
        if (optmatch) {
          return {
            status: "success",
            message: "Entered otp is correct",
            data: finduser.rows
          };
        } else {
          return { 
            status: "failure", 
            message: "Invalid or expired OTP. Please regenerate or enter the correct OTP." 
          };
        }
      }
    } catch (error) {
      console.error("Query Execution Error: IN forgotPassword", error);
      const errorMessage = await ErrorHandler.handleQueryError(error);
      return errorMessage;
    }
  }

  public static async login(params: UserLoginParams): Promise<UserServiceResponse> {
    try {
      const ecomQuery = `SELECT * FROM users WHERE LOWER(useremail) = LOWER($1)`;
      const ecomResult = await query(ecomQuery, [params.useremail]);

      if (ecomResult.rows.length > 0) {
        const validatePassword = await hashValidator(
          params.userpassword,
          ecomResult.rows[0].userpassword
        );

        if (validatePassword) {
          const sessionId = uuidv4();
          const sessionData = {
            useremail: params.useremail,
            userpassword: params.userpassword
          };
          const sessionSaved = await saveSession(sessionId, sessionData);

          if (sessionSaved) {
            return { sessionId, userdata: ecomResult.rows };
          } else {
            return { message: "Please Contact Admin. You are Not Authorized to Login" };
          }
        } else {
          return { message: "User Credentials are wrong. Please try again" };
        }
      } else {
        const inventoryQuery = `SELECT * FROM inventoryusers WHERE useremail = $1`;
        const inventoryResult = await query(inventoryQuery, [params.useremail]);

        if (inventoryResult.rows.length > 0) {
          const validatePassword = await hashValidator(
            params.userpassword,
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
            const sessionSaved = await saveSession(sessionId, sessionData);

            if (sessionSaved) {
              return {
                sessionId,
                userdata: inventoryResult.rows,
                redirect: true,
                inventoryAppUrl: `${REDIRECT_INVENTORY_URL}?sessionId=${sessionId}`
              };
            } else {
              return { message: "Please Contact Admin. You are Not Authorized to Login" };
            }
          } else {
            return { message: "User Credentials are wrong. Please try again" };
          }
        } else {
          return { message: "No Users Found With this Email ID. Please Sign up" };
        }
      }
    } catch (error) {
      console.error("Query Execution Error: IN login", error);
      const errorMessage = await ErrorHandler.handleQueryError(error);
      return errorMessage;
    }
  }

  public static async deleteUser(id: number): Promise<UserServiceResponse> {
    try {
      const result = await query(`DELETE FROM users WHERE id = $1`, [id]);
      if (result.rowCount !== 0) {
        return { message: `${result.rowCount} User deleted successfully` };
      } else {
        return { message: `User not found with id ${id}` };
      }
    } catch (error) {
      console.error("Query Execution Error: IN deleteUser", error);
      const errorMessage = await ErrorHandler.handleQueryError(error);
      return errorMessage;
    }
  }

  public static async logout(): Promise<UserServiceResponse> {
    return { status: "Session deleted" };
  }

  public static async upsertUser(userData: User): Promise<UserServiceResponse> {
    try {
      if (!userData.id) {
        const checkEmailQuery = `
          SELECT id, 'users' as table_name FROM users WHERE useremail = $1
          UNION ALL
          SELECT id, 'inventoryusers' as table_name FROM inventoryusers WHERE useremail = $1
        `;
        const emailCheckResult = await query(checkEmailQuery, [userData.useremail]);

        if (emailCheckResult.rows.length > 0) {
          return {
            command: 'Fail',
            message: "Email already exists. Please try sign in with new E-Mail"
          };
        }

        const hashedPassword = await hashGenerate(userData.userpassword);

        const insertData = {
          firstname: userData.firstname,
          lastname: userData.lastname,
          useremail: userData.useremail,
          userpassword: hashedPassword,
          usermobilenumber: userData.usermobilenumber
        };

        const insertFields = Object.keys(insertData);
        const insertValues = Object.values(insertData);

        const insertQuery = `
          INSERT INTO users (${insertFields.join(", ")}) 
          VALUES (${insertFields.map((_, index) => `$${index + 1}`).join(", ")}) 
          RETURNING *
        `;

        const result = await query(insertQuery, insertValues);

        return {
          command: "INSERT",
          rows: result.rows
        };
      }

      const { id, ...updateFields } = userData;

      const checkUserQuery = `SELECT * FROM users WHERE id = $1`;
      const userExists = await query(checkUserQuery, [id]);

      if (userExists.rows.length === 0) {
        return { command: 'Fail', message: "User not found" };
      }

      const updateData: Partial<User> = {};

      if (updateFields.useremail) {
        updateData.useremail = updateFields.useremail;
      }
      if (updateFields.userpassword) {
        updateData.userpassword = await hashGenerate(updateFields.userpassword);
      }

      if (Object.keys(updateData).length === 0) {
        return { command: 'Fail', message: "No fields to update" };
      }

      const updateQueryFields = Object.keys(updateData);
      const updateValues = Object.values(updateData);

      const updateQuery = `
        UPDATE users 
        SET ${updateQueryFields.map((field, index) => `${field} = $${index + 1}`).join(", ")} 
        WHERE id = $${updateQueryFields.length + 1} 
        RETURNING *
      `;

      const result = await query(updateQuery, [...updateValues, id]);

      return {
        command: "UPDATE",
        rows: result.rows
      };
    } catch (error) {
      console.error("Query Execution Error in upsertUser:", error);
      const errorMessage = await ErrorHandler.handleQueryError(error);
      return errorMessage;
    }
  }
}
