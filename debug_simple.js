import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugSimple() {
  console.log('=== SIMPLE DEBUG ===\n');

  try {
    // Get the raw data
    const rawData = await prisma.$queryRawUnsafe(
      'SELECT * FROM poinvoice WHERE id = $1',
      5
    );
    
    console.log('1. RAW DATABASE DATA:');
    console.log('paymentdata:', JSON.stringify(rawData[0].paymentdata));
    console.log('paymentdata type:', typeof rawData[0].paymentdata);
    console.log('');

    // Test the service
    const { PoinvoiceService } = await import('./build/services/poinvoice.service.js');
    const service = new PoinvoiceService();
    
    const serviceResult = await service.findById('5');
    console.log('2. SERVICE RESULT:');
    console.log('paymentdata:', JSON.stringify(serviceResult.paymentdata));
    console.log('paymentdata type:', typeof serviceResult.paymentdata);
    console.log('');

    // Test the formatter
    const { formatPoinvoiceForAPI } = await import('./build/utils/dynamicDbOperations.js');
    
    const formatted = formatPoinvoiceForAPI(serviceResult);
    console.log('3. FORMATTED RESULT:');
    console.log('paymentdata:', JSON.stringify(formatted.paymentdata));
    console.log('paymentdata type:', typeof formatted.paymentdata);
    console.log('');

    // Test the controller logic
    const { PoinvoiceController } = await import('./build/controllers/poinvoice.controller.js');
    
    // Simulate the controller call
    console.log('4. TESTING CONTROLLER LOGIC:');
    const controller = new PoinvoiceController();
    
    // Mock request and reply objects
    const mockRequest = {
      params: { id: '5' }
    };
    
    const mockReply = {
      code: (statusCode) => ({
        send: (response) => {
          console.log('Controller response paymentdata:', JSON.stringify(response.data.paymentdata));
          console.log('Controller response paymentdata type:', typeof response.data.paymentdata);
          return response;
        }
      })
    };
    
    await controller.getPoinvoice(mockRequest, mockReply);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugSimple(); 