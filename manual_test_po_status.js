import axios from 'axios';

const API_BASE_URL = 'http://localhost:5600';

async function testPOStatusUpdate() {
    console.log('🧪 Testing Production-Ready PO Status Update Logic');
    console.log('================================================');
    
    try {
        // Step 1: Create a test purchase order
        console.log('\n1. Creating test purchase order...');
        const testPO = {
            ponumber: `TEST-PO-${Date.now()}`,
            companyname: 'Test Company',
            total: 1000,
            supplierid: 97,
            po_status: 'in_progress'
        };
        
        const poResponse = await axios.post(`${API_BASE_URL}/v1/purchaseorders`, testPO);
        
        if (poResponse.status === 201 && poResponse.data.success) {
            const ponumber = poResponse.data.data.ponumber;
            console.log(`✅ Created PO: ${ponumber} with total: $${testPO.total}`);
            
            // Step 2: Create first poinvoice with partial payment
            console.log('\n2. Creating poinvoice with partial payment ($300)...');
            const partialPayment = {
                ponumber: ponumber,
                invoiceamount: 300,
                invoicenumber: `INV-${Date.now()}-1`,
                paymentdata: [
                    {
                        paymentamount: 300,
                        paymentdate: new Date().toISOString().split('T')[0],
                        paymentmethod: 'check',
                        comments: 'Partial payment test'
                    }
                ]
            };
            
            const partialResponse = await axios.post(`${API_BASE_URL}/v1/poinvoices`, partialPayment);
            console.log(`Response status: ${partialResponse.status}`);
            
            if (partialResponse.data.success) {
                console.log('✅ Partial payment poinvoice created');
                
                // Check PO status
                const poCheckResponse = await axios.get(`${API_BASE_URL}/v1/purchaseorders?filters[ponumber]=${ponumber}`);
                if (poCheckResponse.data.success && poCheckResponse.data.data.length > 0) {
                    const currentPO = poCheckResponse.data.data[0];
                    console.log(`📊 PO Status after partial payment: ${currentPO.po_status}`);
                    
                    if (currentPO.po_status === 'partially_fulfilled') {
                        console.log('✅ Status correctly updated to "partially_fulfilled"');
                    } else {
                        console.log(`❌ Expected "partially_fulfilled", got "${currentPO.po_status}"`);
                    }
                }
                
                // Step 3: Create second poinvoice to complete payment
                console.log('\n3. Creating poinvoice with remaining payment ($700)...');
                const fullPayment = {
                    ponumber: ponumber,
                    invoiceamount: 700,
                    invoicenumber: `INV-${Date.now()}-2`,
                    paymentdata: [
                        {
                            paymentamount: 700,
                            paymentdate: new Date().toISOString().split('T')[0],
                            paymentmethod: 'ach',
                            comments: 'Final payment test'
                        }
                    ]
                };
                
                const fullResponse = await axios.post(`${API_BASE_URL}/v1/poinvoices`, fullPayment);
                console.log(`Response status: ${fullResponse.status}`);
                
                if (fullResponse.data.success) {
                    console.log('✅ Full payment poinvoice created');
                    
                    // Final status check
                    const finalCheckResponse = await axios.get(`${API_BASE_URL}/v1/purchaseorders?filters[ponumber]=${ponumber}`);
                    if (finalCheckResponse.data.success && finalCheckResponse.data.data.length > 0) {
                        const finalPO = finalCheckResponse.data.data[0];
                        console.log(`📊 Final PO Status: ${finalPO.po_status}`);
                        
                        if (finalPO.po_status === 'fulfilled') {
                            console.log('✅ Status correctly updated to "fulfilled"');
                            console.log('\n🎉 All tests PASSED! Production-ready implementation working correctly.');
                        } else {
                            console.log(`❌ Expected "fulfilled", got "${finalPO.po_status}"`);
                            console.log('\n❌ Test FAILED - Status update logic needs debugging');
                        }
                    }
                } else {
                    console.log('❌ Failed to create full payment poinvoice');
                    console.log(fullResponse.data);
                }
            } else {
                console.log('❌ Failed to create partial payment poinvoice');
                console.log(partialResponse.data);
            }
        } else {
            console.log('❌ Failed to create test purchase order');
            console.log(poResponse.data);
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the test
testPOStatusUpdate(); 