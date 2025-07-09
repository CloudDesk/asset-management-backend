const axios = require('axios');
const assert = require('assert');

// Configuration
const API_BASE_URL = 'http://localhost:5600/v1';
const RATINGS_ENDPOINT = `${API_BASE_URL}/ratings`;

// Test data setup
let testUserId;
let testProductId;
let testOrderId;
let testOrderLineId;

// Helper function to create test user
async function createTestUser() {
  try {
    const response = await axios.post(`${API_BASE_URL}/users`, {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'user'
    });
    return response.data.data.id;
  } catch (error) {
    console.error('Error creating test user:', error.response?.data || error.message);
    throw error;
  }
}

// Helper function to create test product
async function createTestProduct() {
  try {
    const response = await axios.post(`${API_BASE_URL}/products`, {
      name: 'Test Product',
      shortdescription: 'Test product for rating',
      price: 99.99,
      quantity: 10
    });
    return response.data.data.id;
  } catch (error) {
    console.error('Error creating test product:', error.response?.data || error.message);
    throw error;
  }
}

// Helper function to create test order
async function createTestOrder(userId, productId) {
  try {
    const response = await axios.post(`${API_BASE_URL}/orders`, {
      userid: userId,
      productid: [productId],
      orderamount: 99.99,
      orderstatus: 'completed',
      quantity: 1
    });
    return response.data.data.id;
  } catch (error) {
    console.error('Error creating test order:', error.response?.data || error.message);
    throw error;
  }
}

// Helper function to create test orderline
async function createTestOrderLine(orderId, productId) {
  try {
    const response = await axios.post(`${API_BASE_URL}/orderlines`, {
      orderid: orderId,
      productid: productId,
      quantity: 1,
      price: 99.99
    });
    return response.data.data.id;
  } catch (error) {
    console.error('Error creating test orderline:', error.response?.data || error.message);
    throw error;
  }
}

// Test data
async function createTestData() {
  testUserId = await createTestUser();
  testProductId = await createTestProduct();
  testOrderId = await createTestOrder(testUserId, testProductId);
  testOrderLineId = await createTestOrderLine(testOrderId, testProductId);
}

const testRating = {
  userid: null, // Will be set after test data creation
  productid: null,
  orderid: null,
  starrating: 4,
  comments: 'Great product!',
  url: ['https://example.com/image1.jpg'],
  usermail: 'test@example.com',
  orderlineid: null
};

// Helper function to create a rating
async function createTestRating(data = { ...testRating }) {
  try {
    // Use the created test data IDs
    const ratingData = {
      ...data,
      userid: testUserId,
      productid: testProductId,
      orderid: testOrderId,
      orderlineid: testOrderLineId
    };
    const response = await axios.post(RATINGS_ENDPOINT, ratingData);
    return response.data.data;
  } catch (error) {
    console.error('Error creating test rating:', error.response?.data || error.message);
    throw error;
  }
}

// Helper function to cleanup test data
async function deleteTestRating(id) {
  try {
    await axios.delete(`${RATINGS_ENDPOINT}/${id}`);
  } catch (error) {
    console.error('Error deleting test rating:', error.response?.data || error.message);
  }
}

// Helper function to cleanup all test data
async function cleanupTestData() {
  try {
    if (testOrderLineId) {
      await axios.delete(`${API_BASE_URL}/orderlines/${testOrderLineId}`);
    }
    if (testOrderId) {
      await axios.delete(`${API_BASE_URL}/orders/${testOrderId}`);
    }
    if (testProductId) {
      await axios.delete(`${API_BASE_URL}/products/${testProductId}`);
    }
    if (testUserId) {
      await axios.delete(`${API_BASE_URL}/users/${testUserId}`);
    }
  } catch (error) {
    console.error('Error cleaning up test data:', error.response?.data || error.message);
  }
}

describe('Rating API Tests', () => {
  let createdRatingId;

  // Create test data before all tests
  before(async () => {
    await createTestData();
  });

  // Cleanup after each test
  afterEach(async () => {
    if (createdRatingId) {
      await deleteTestRating(createdRatingId);
      createdRatingId = null;
    }
  });

  // Cleanup all test data after all tests
  after(async () => {
    await cleanupTestData();
  });

  describe('POST /ratings', () => {
    it('should create a new rating', async () => {
      const response = await createTestRating();
      assert.ok(response.id);
      createdRatingId = response.id;
    });

    it('should validate star rating range', async () => {
      try {
        await createTestRating({ starrating: 6 });
        assert.fail('Should have thrown validation error');
  } catch (error) {
        assert.strictEqual(error.response.status, 400);
      }
    });
  });

  describe('GET /ratings', () => {
    beforeEach(async () => {
      const rating = await createTestRating();
      createdRatingId = rating.id;
    });

    it('should get all ratings with pagination', async () => {
      const response = await axios.get(RATINGS_ENDPOINT);
      assert.strictEqual(response.status, 200);
      assert.ok(response.data.success);
      assert.ok(Array.isArray(response.data.data));
      assert.ok(response.data.pagination);
    });

    it('should filter ratings by star rating', async () => {
      const response = await axios.get(`${RATINGS_ENDPOINT}?starrating=4`);
      assert.strictEqual(response.status, 200);
      assert.ok(response.data.success);
      assert.ok(Array.isArray(response.data.data));
      response.data.data.forEach(rating => {
        assert.strictEqual(rating.starrating, 4);
      });
    });
  });

  describe('GET /ratings/:id', () => {
    beforeEach(async () => {
      const rating = await createTestRating();
      createdRatingId = rating.id;
    });

    it('should get a rating by ID', async () => {
      const response = await axios.get(`${RATINGS_ENDPOINT}/${createdRatingId}`);
      assert.strictEqual(response.status, 200);
      assert.ok(response.data.success);
      assert.strictEqual(response.data.data.id, createdRatingId);
    });

    it('should return 404 for non-existent rating', async () => {
      try {
        await axios.get(`${RATINGS_ENDPOINT}/999999`);
        assert.fail('Should have thrown not found error');
      } catch (error) {
        assert.strictEqual(error.response.status, 404);
      }
    });
  });

  describe('PUT /ratings/:id', () => {
    beforeEach(async () => {
      const rating = await createTestRating();
      createdRatingId = rating.id;
    });

    it('should update a rating', async () => {
      const updateData = {
        starrating: 5,
        comments: 'Updated comment'
      };
      const response = await axios.put(`${RATINGS_ENDPOINT}/${createdRatingId}`, updateData);
      assert.strictEqual(response.status, 200);
      assert.ok(response.data.success);
      assert.strictEqual(response.data.data.starrating, 5);
      assert.strictEqual(response.data.data.comments, 'Updated comment');
    });
  });

  describe('DELETE /ratings/:id', () => {
    beforeEach(async () => {
      const rating = await createTestRating();
      createdRatingId = rating.id;
    });

    it('should delete a rating', async () => {
      const response = await axios.delete(`${RATINGS_ENDPOINT}/${createdRatingId}`);
      assert.strictEqual(response.status, 200);
      assert.ok(response.data.success);

      // Verify deletion
      try {
        await axios.get(`${RATINGS_ENDPOINT}/${createdRatingId}`);
        assert.fail('Should have thrown not found error');
  } catch (error) {
        assert.strictEqual(error.response.status, 404);
      }
      createdRatingId = null; // Prevent cleanup attempt
    });
  });

  describe('GET /ratings/user/:userId', () => {
    beforeEach(async () => {
      const rating = await createTestRating();
      createdRatingId = rating.id;
    });

    it('should get ratings by user ID', async () => {
      const response = await axios.get(`${RATINGS_ENDPOINT}/user/${testUserId}`);
      assert.strictEqual(response.status, 200);
      assert.ok(response.data.success);
      assert.ok(Array.isArray(response.data.data));
      response.data.data.forEach(rating => {
        assert.strictEqual(rating.userid, testUserId);
      });
    });
  });

  describe('GET /ratings/product/:productId', () => {
    beforeEach(async () => {
      const rating = await createTestRating();
      createdRatingId = rating.id;
    });

    it('should get ratings by product ID', async () => {
      const response = await axios.get(`${RATINGS_ENDPOINT}/product/${testProductId}`);
      assert.strictEqual(response.status, 200);
      assert.ok(response.data.success);
      assert.ok(Array.isArray(response.data.data));
      response.data.data.forEach(rating => {
        assert.strictEqual(rating.productid, testProductId);
      });
    });
  });

  describe('GET /ratings/order/:orderId', () => {
    beforeEach(async () => {
      const rating = await createTestRating();
      createdRatingId = rating.id;
    });

    it('should get ratings by order ID', async () => {
      const response = await axios.get(`${RATINGS_ENDPOINT}/order/${testOrderId}`);
      assert.strictEqual(response.status, 200);
      assert.ok(response.data.success);
      assert.ok(Array.isArray(response.data.data));
      response.data.data.forEach(rating => {
        assert.strictEqual(rating.orderid, testOrderId);
      });
    });
  });

  describe('GET /ratings/product/:productId/average', () => {
    beforeEach(async () => {
      const rating = await createTestRating();
      createdRatingId = rating.id;
    });

    it('should get average rating for a product', async () => {
      const response = await axios.get(`${RATINGS_ENDPOINT}/product/${testProductId}/average`);
      assert.strictEqual(response.status, 200);
      assert.ok(response.data.success);
      assert.ok('averageRating' in response.data.data);
      assert.ok('totalRatings' in response.data.data);
    });
  });

  describe('POST /ratings/upsert', () => {
    it('should create a new rating via upsert', async () => {
      const response = await axios.post(`${RATINGS_ENDPOINT}/upsert`, {
        userid: testUserId,
        productid: testProductId,
        orderid: testOrderId,
        orderlineid: testOrderLineId,
        starrating: 4,
        comments: 'Created via upsert'
      });
      assert.strictEqual(response.status, 200);
      assert.ok(response.data.success);
      assert.ok(response.data.data.id);
      createdRatingId = response.data.data.id;
    });

    it('should update an existing rating via upsert', async () => {
      // First create a rating
      const rating = await createTestRating();
      createdRatingId = rating.id;

      // Then update it via upsert
      const updateData = {
        id: createdRatingId,
        starrating: 5,
        comments: 'Updated via upsert'
      };
      const response = await axios.post(`${RATINGS_ENDPOINT}/upsert`, updateData);
      assert.strictEqual(response.status, 200);
      assert.ok(response.data.success);
      assert.strictEqual(response.data.data.id, createdRatingId);
      assert.strictEqual(response.data.data.starrating, 5);
      assert.strictEqual(response.data.data.comments, 'Updated via upsert');
    });
  });
}); 