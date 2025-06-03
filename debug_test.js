import axios from 'axios';

const API_BASE_URL = 'http://localhost:5600';

async function simpleDebugTest() {
    console.log('🔍 Simple Debug Test: Single Poinvoice Creation');
    console.log('=================================================\n');
    
    try {
        // Create a very simple poinvoice for an existing PO
        const poinvoiceData = {
            ponumber: 'PO-0000000042',  // Use our existing PO
            invoiceamount: 100,
            invoicenumber: `SIMPLE-DEBUG-${Date.now()}`,
            paymentdata: [
                {
                    paymentamount: 100,
                    paymentdate: '2024-06-03',
                    paymentmethod: 'check',
                    comments: 'Simple debug test'
                }
            ]
        };
        
        console.log('Creating poinvoice for PO: PO-0000000042');
        console.log('Payment amount:', 100);
        
        const response = await axios.post(`${API_BASE_URL}/v1/poinvoices`, poinvoiceData);
        
        console.log('Response status:', response.status);
        console.log('Success:', response.data.success);
        
        if (response.data.success) {
            console.log('Created poinvoice ID:', response.data.data.id);
            console.log('Purchase order status in response:', response.data.data.purchaseorderstatus);
            
            // Check the actual PO status
            await new Promise(resolve => setTimeout(resolve, 1000));
            const poResponse = await axios.get(`${API_BASE_URL}/v1/purchaseorders?filters[ponumber]=PO-0000000042`);
            
            if (poResponse.data.success && poResponse.data.data.length > 0) {
                const po = poResponse.data.data[0];
                console.log('PO status after poinvoice creation:', po.po_status);
                console.log('PO total:', po.total);
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response?.data) {
            console.error('Response data:', error.response.data);
        }
    }
}

simpleDebugTest(); 