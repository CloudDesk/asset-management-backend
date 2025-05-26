import { ProductQueryParams } from '../interfaces/product.interface.js';
import { BASE_CONDITIONS, DEFAULT_ORDER_BY } from '../constants/product.constants.js';
import { Pool } from 'pg';

export class QueryBuilder {
  private whereClauses: string[] = [];
  private queryParams: any[] = [];
  private parameterIndex: number = 1;
  private orderByField: string = DEFAULT_ORDER_BY.field;
  private orderByDirection: string = DEFAULT_ORDER_BY.direction;
  private pool: Pool;
  private tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.pool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '5432')
    });
  }

  public buildWhereClause(queryParams: ProductQueryParams): void {
    const keys = Object.keys(queryParams);
    const values = Object.values(queryParams);

    keys.forEach((key, index) => {
      if (key === 'page' || key === 'count') return;

      const paramValues: any = Array.isArray(values[index]) ? values[index] : [values[index]];

      if (key === 'displaysize' || key === 'price') {
        this.handleRangeClause(key, paramValues);
      } else if (key === 'sortby') {
        this.handleSortBy(paramValues[0]);
      } else {
        this.handleNormalClause(key, paramValues);
      }
    });
  }

  private handleRangeClause(key: string, paramValues: any[]): void {
    const rangeClauses = paramValues.map(range => {
      const [lowerBound, upperBound] = range.split('-');
      this.queryParams.push(lowerBound, upperBound);
      const clause = `(${key} BETWEEN $${this.parameterIndex} AND $${this.parameterIndex + 1})`;
      this.parameterIndex += 2;
      return clause;
    });
    this.whereClauses.push(`(${rangeClauses.join(' OR ')})`);
  }

  private handleSortBy(sortValue: string): void {
    const [fieldName, direction] = sortValue.split('-');
    this.orderByField = fieldName;
    this.orderByDirection = direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  }

  private handleNormalClause(key: string, paramValues: any[]): void {
    const clauses = paramValues.map(value => {
      if (value.startsWith('NOT ')) {
        const cleanValue = value.slice(4);
        this.queryParams.push(cleanValue);
        const clause = `${key} != $${this.parameterIndex}`;
        this.parameterIndex++;
        return clause;
      } else if (value.toUpperCase() === 'NULL') {
        return `${key} IS NULL`;
      } else {
        this.queryParams.push(value);
        const clause = `${key} = $${this.parameterIndex}`;
        this.parameterIndex++;
        return clause;
      }
    });
    this.whereClauses.push(`(${clauses.join(' OR ')})`);
  }

  public buildQuery(pageNumber: number, recordCount: number): { query: string; params: any[] } {
    const offset = (pageNumber - 1) * recordCount;
    const whereClause = this.whereClauses.length > 0 
      ? `WHERE ${this.whereClauses.join(' AND ')} AND ${BASE_CONDITIONS}`
      : `WHERE ${BASE_CONDITIONS}`;
    
    const orderByClause = `ORDER BY ${this.orderByField} ${this.orderByDirection}`;
    
    let queryText = `SELECT * FROM ${this.tableName} ${whereClause} ${orderByClause}`;
    
    if (pageNumber && recordCount) {
      queryText += ` OFFSET $${this.parameterIndex} LIMIT $${this.parameterIndex + 1}`;
      this.queryParams.push(offset, recordCount);
    }

    return {
      query: queryText,
      params: this.queryParams
    };
  }

  public async executeQuery(query: string, params: any[] = []): Promise<any> {
    try {
      const result = await this.pool.query(query, params);
      return result;
    } catch (error) {
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async findOne(conditions: Record<string, any>): Promise<any> {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    const query = `SELECT * FROM ${this.tableName} WHERE ${keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ')} LIMIT 1`;
    return this.executeQuery(query, values);
  }

  public async find(conditions: Record<string, any> = {}): Promise<any> {
    if (Object.keys(conditions).length === 0) {
      return this.executeQuery(`SELECT * FROM ${this.tableName}`);
    }
    return this.findOne(conditions);
  }

  public async create(data: Record<string, any>): Promise<any> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const query = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
    return this.executeQuery(query, values);
  }

  public async update(id: number, data: Record<string, any>): Promise<any> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const query = `UPDATE ${this.tableName} SET ${keys.map((key, i) => `${key} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} RETURNING *`;
    return this.executeQuery(query, [...values, id]);
  }

  public async delete(id: number): Promise<any> {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`;
    return this.executeQuery(query, [id]);
  }
} 