# Asset Management Backend

A Fastify-based backend API for managing assets and stock inventory.

## Features

- RESTful API endpoints for stock management
- Swagger documentation
- TypeScript support
- PostgreSQL database integration
- Authentication middleware
- Pagination and filtering support

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/asset-management-backend.git
cd asset-management-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
PORT=3000
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

## Development

To start the development server with hot reload:
```bash
npm run dev
```

## Building

To build the project:
```bash
npm run build
```

## Running in Production

To start the production server:
```bash
npm start
```

## API Documentation

Once the server is running, you can access the Swagger documentation at:
```
http://localhost:3000/documentation
```

## API Endpoints

### Stock Management

- `GET /stockrevo` - Get all stocks with pagination and filters
- `GET /stockrevo/:id` - Get a single stock by ID
- `POST /stockrevo` - Create or update a stock
- `DELETE /stockrevo/:id` - Delete a stock
- `GET /stockrevo/deleted` - Get all deleted stocks
- `GET /stockrevo/archived` - Get all archived stocks
- `GET /stockrevo/ewaste` - Get all e-waste stocks
- `PUT /stockrevo/ewaste/:id` - Update stock to e-waste
- `POST /stockrevo/rfid` - Update stock RFID data
- `POST /stockrevo/bulk` - Bulk update stock quantities

## Authentication

All endpoints require authentication using a session token. Include the token in the request header:
```
x-session-token: your-session-token
```

## Error Handling

The API uses standard HTTP status codes and returns error responses in the following format:
```json
{
  "success": false,
  "errorMessage": "Error description",
  "statusCode": 400
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 