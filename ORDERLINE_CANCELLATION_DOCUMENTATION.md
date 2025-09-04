# Orderline Cancellation Feature Documentation

## Overview

This document describes the comprehensive orderline cancellation system that has been implemented to handle order cancellations with proper product quantity restoration and automatic order status updates.

## Features

### ✅ Implemented Features

1. **Individual Orderline Cancellation**

   - Cancel specific orderlines with optional reason
   - Automatic product quantity restoration
   - Order status update when all orderlines are cancelled

2. **Product Quantity Management**

   - Restores `orderedquantity` (decreases by cancelled quantity)
   - Restores `availablequantity` (increases by cancelled quantity)
   - Updates product status based on new available quantity

3. **Order Status Management**

   - Automatically updates order status to "cancelled" when all orderlines are cancelled
   - Maintains order status if some orderlines remain active

4. **Comprehensive Logging**

   - Detailed logging for debugging and monitoring
   - Transaction tracking for audit purposes

5. **Error Handling**
   - Graceful handling of already cancelled orderlines
   - Proper error responses for invalid requests
   - Rollback capabilities for failed operations

## API Endpoints

### PATCH /v1/orderlines/:id/cancel

**Description**: Cancel an orderline and restore product quantities. If all orderlines in the order are cancelled, the order status will be updated to cancelled.

**Parameters**:

- `id` (path): Orderline ID (required)

**Request Body**:

```json
{
  "reason": "Optional reason for cancellation"
}
```

**Response**:

```json
{
  "success": true,
  "message": "Orderline cancelled successfully",
  "data": {
    "orderline": {
      "id": 123,
      "orderstatus": "cancelled",
      "cancelleddate": 1703123456789,
      "cancellation_reason": "Customer request"
      // ... other orderline fields
    },
    "productUpdates": [
      {
        "productId": 1,
        "success": true,
        "productName": "Test Product",
        "quantityRestored": 2,
        "oldQuantities": {
          "ordered": 10,
          "available": 5,
          "status": "low_stock"
        },
        "newQuantities": {
          "ordered": 8,
          "available": 7,
          "status": "in_stock"
        }
      }
    ],
    "orderStatusUpdated": false,
    "cancellationDetails": {
      "orderlineId": "123",
      "productId": 1,
      "orderId": 456,
      "restoredQuantity": 2,
      "reason": "Customer request"
    }
  }
}
```

## Business Logic

### Orderline Cancellation Process

1. **Validation**

   - Check if orderline exists
   - Check if orderline is already cancelled
   - Validate orderline status

2. **Orderline Update**

   - Set `orderstatus` to "cancelled"
   - Set `cancelleddate` to current timestamp
   - Set `cancellation_reason` if provided
   - Update `modifieddate`

3. **Product Quantity Restoration**

   - Get current product quantities
   - Calculate new quantities:
     - `newOrderedQuantity = currentOrderedQuantity - cancelledQuantity`
     - `newAvailableQuantity = currentAvailableQuantity + cancelledQuantity`
   - Update product status based on new available quantity
   - Update product record

4. **Order Status Check**
   - Get all orderlines for the order
   - Check if all orderlines are cancelled
   - If all cancelled, update order status to "cancelled"
   - If not all cancelled, keep order status unchanged

### Product Status Logic

```typescript
if (newAvailableQuantity <= 0) {
  newProductStatus = "out_of_stock";
} else if (newAvailableQuantity >= 1 && newAvailableQuantity <= 5) {
  newProductStatus = "low_stock";
} else {
  newProductStatus = "in_stock";
}
```

## Database Schema Updates

### Orderline Table

- `cancellation_reason` field added for tracking cancellation reasons

### Product Table

- `orderedquantity` and `availablequantity` are automatically updated
- `productstatus` is automatically updated based on available quantity

## Error Scenarios

### Already Cancelled Orderline

- Returns success with message "Orderline is already cancelled"
- No further processing

### Non-existent Orderline

- Returns 404 error
- No product quantity changes

### Invalid Orderline ID

- Returns 400 error
- No database changes

### Product Not Found

- Logs warning
- Continues with order status update
- Returns partial success

## Testing

### Test Coverage

1. **Basic Cancellation**

   - Cancel single orderline
   - Verify product quantity restoration
   - Verify orderline status update

2. **Order Status Updates**

   - Cancel all orderlines in order
   - Verify order status changes to "cancelled"
   - Cancel partial orderlines
   - Verify order status remains unchanged

3. **Edge Cases**

   - Cancel already cancelled orderline
   - Cancel non-existent orderline
   - Cancel with invalid ID
   - Handle missing products

4. **Bulk Operations**
   - Cancel multiple orderlines
   - Verify all product quantities restored
   - Verify order status updates correctly

### Running Tests

```bash
# Run comprehensive tests
./run_orderline_cancellation_tests.sh

# Or run individual test file
node test_orderline_cancellation_comprehensive.js
```

## Production Considerations

### Performance

- Database operations are optimized with proper indexing
- Logging is structured for easy monitoring
- Error handling prevents partial updates

### Monitoring

- All operations are logged with structured data
- Product quantity changes are tracked
- Order status changes are monitored

### Security

- Input validation prevents injection attacks
- Proper error messages don't expose internal details
- Authentication/authorization should be added as needed

## Integration Points

### Frontend Integration

- Use `PATCH /v1/orderlines/:id/cancel` endpoint
- Handle success/error responses appropriately
- Display updated product quantities
- Show order status changes

### Other Systems

- Product inventory systems will see updated quantities
- Order management systems will see status changes
- Reporting systems can track cancellation reasons

## Future Enhancements

### Potential Improvements

1. **Bulk Cancellation API**

   - Cancel multiple orderlines in single request
   - Batch product quantity updates

2. **Cancellation Workflows**

   - Approval workflows for cancellations
   - Different cancellation types (customer, system, admin)

3. **Refund Integration**

   - Automatic refund processing
   - Payment gateway integration

4. **Notification System**

   - Email notifications for cancellations
   - SMS alerts for critical cancellations

5. **Analytics**
   - Cancellation reason analytics
   - Product performance tracking
   - Customer behavior analysis

## Troubleshooting

### Common Issues

1. **Product quantities not restored**

   - Check if product exists in database
   - Verify product ID mapping
   - Check database constraints

2. **Order status not updated**

   - Verify all orderlines are cancelled
   - Check orderline status values
   - Review database permissions

3. **Performance issues**
   - Check database indexes
   - Monitor query performance
   - Review logging levels

### Debug Information

- All operations include detailed logging
- Product quantity changes are tracked
- Order status changes are logged
- Error scenarios are documented

## Conclusion

The orderline cancellation system provides a robust, production-ready solution for handling order cancellations with proper inventory management and status tracking. The implementation includes comprehensive error handling, logging, and testing to ensure reliability in production environments.
