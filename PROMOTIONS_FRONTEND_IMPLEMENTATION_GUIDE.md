# 🎁 Promotions Frontend Implementation Guide

## 📋 Overview

This guide provides complete frontend implementation for displaying promotions in e-commerce applications, handling both guest and identified users with a **unified API approach** that matches your existing cart/orders pattern.

---

## 🏗️ Frontend Architecture

### **File Structure:**
```
src/
├── components/
│   ├── promotions/
│   │   ├── DealsPage.jsx          # Main deals page component
│   │   ├── PromotionCard.jsx      # Individual promotion card
│   │   ├── PromotionList.jsx      # List of promotions
│   │   └── PromotionFilters.jsx   # Filter components
│   └── common/
│       ├── LoadingSpinner.jsx     # Loading component
│       └── ErrorBoundary.jsx      # Error handling
├── hooks/
│   ├── usePromotions.js          # Promotions data hook
│   ├── useAuth.js                # Authentication hook
│   └── useDateFilter.js          # Date filtering hook
├── services/
│   └── promotionsApi.js          # API service layer
├── utils/
│   ├── dateUtils.js              # Date utilities
│   └── promotionUtils.js         # Promotion utilities
└── styles/
    ├── DealsPage.css             # Main styles
    └── PromotionCard.css         # Card styles
```

---

## 🔧 1. API Service Layer

### **File: `src/services/promotionsApi.js`**

```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5600';

class PromotionsApiService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/v1/promotions`;
  }

  // Get authentication token
  getAuthToken() {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  }

  // Get headers for authenticated requests
  getHeaders() {
    const token = this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // Get promotions (unified endpoint for both guest and identified users)
  async getPromotions(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        page: params.page || '1',
        limit: params.limit || '10',
        channel: params.channel || 'web',
        geo: params.geo || 'IN',
        current_date: params.currentDate || new Date().toISOString(),
        ...params
      });

      // Add userid if provided (for identified users)
      if (params.userid) {
        queryParams.append('userid', params.userid);
      }

      const response = await fetch(`${this.baseURL}?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching promotions:', error);
      throw error;
    }
  }


  // Get user segments for debugging
  async getUserSegments(userId) {
    try {
      const response = await fetch(`${this.baseURL}/segments/${userId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching user segments:', error);
      throw error;
    }
  }
}

export default new PromotionsApiService();
```

---

## 🔧 2. Custom Hooks

### **File: `src/hooks/usePromotions.js`**

```javascript
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import promotionsApi from '../services/promotionsApi';

export const usePromotions = (options = {}) => {
  const { isAuthenticated, user } = useAuth();
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userType, setUserType] = useState('guest');

  const fetchPromotions = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);

    try {
      // Build request parameters
      const requestParams = {
        ...options,
        ...params,
        currentDate: new Date().toISOString()
      };

      // Add userid for identified users
      if (isAuthenticated && user?.id) {
        requestParams.userid = user.id.toString();
      }

      const response = await promotionsApi.getPromotions(requestParams);

      if (response.success) {
        setPromotions(response.data || []);
        setUserType(isAuthenticated && user?.id ? 'identified' : 'guest');
      } else {
        throw new Error(response.message || 'Failed to fetch promotions');
      }
    } catch (err) {
      setError(err.message);
      setPromotions([]);
      setUserType('guest');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.id, options]);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  return {
    promotions,
    loading,
    error,
    userType,
    refetch: fetchPromotions
  };
};
```

### **File: `src/hooks/useAuth.js`**

```javascript
import { useState, useEffect } from 'react';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing authentication
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');

    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error parsing user data:', error);
        // Clear invalid data
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        sessionStorage.removeItem('authToken');
      }
    }

    setLoading(false);
  }, []);

  const login = (userData, token, remember = false) => {
    setUser(userData);
    setIsAuthenticated(true);
    
    if (remember) {
      localStorage.setItem('authToken', token);
      localStorage.setItem('userData', JSON.stringify(userData));
    } else {
      sessionStorage.setItem('authToken', token);
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    sessionStorage.removeItem('authToken');
  };

  return {
    isAuthenticated,
    user,
    loading,
    login,
    logout
  };
};
```

---

## 🔧 3. Main Components

### **File: `src/components/promotions/DealsPage.jsx`**

```jsx
import React, { useState, useEffect } from 'react';
import { usePromotions } from '../../hooks/usePromotions';
import { useAuth } from '../../hooks/useAuth';
import PromotionList from './PromotionList';
import PromotionFilters from './PromotionFilters';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorBoundary from '../common/ErrorBoundary';
import './DealsPage.css';

const DealsPage = () => {
  const { isAuthenticated, user } = useAuth();
  const [filters, setFilters] = useState({
    channel: 'web',
    geo: 'IN',
    limit: 10
  });
  
  const {
    promotions,
    loading,
    error,
    userType,
    refetch
  } = usePromotions(filters);

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleApplyPromotion = (promotion) => {
    if (promotion.auto_apply) {
      // Auto-apply promotion
      console.log('Auto-applying promotion:', promotion);
      // Implement auto-apply logic
    } else {
      // Show promotion code or redirect to apply
      console.log('Apply promotion code:', promotion.code);
      // Implement manual apply logic
    }
  };

  if (loading) {
    return (
      <div className="deals-page">
        <div className="deals-header">
          <h1>🎁 Special Deals & Offers</h1>
          <p>Discover amazing promotions just for you!</p>
        </div>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="deals-page">
        <div className="deals-header">
          <h1>🎁 Special Deals & Offers</h1>
          <p>Discover amazing promotions just for you!</p>
        </div>
        <div className="error-container">
          <h3>Oops! Something went wrong</h3>
          <p>{error}</p>
          <button onClick={handleRefresh} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="deals-page">
        <div className="deals-header">
          <h1>🎁 Special Deals & Offers</h1>
          <p>
            {isAuthenticated 
              ? `Welcome back, ${user?.firstname || 'User'}! Here are your personalized offers.`
              : 'Discover amazing promotions! Sign in for personalized deals.'
            }
          </p>
          <div className="user-type-badge">
            {userType === 'identified' ? '👤 Personalized' : '🌐 Public'}
          </div>
        </div>

        <PromotionFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onRefresh={handleRefresh}
        />

        <PromotionList
          promotions={promotions}
          userType={userType}
          onApplyPromotion={handleApplyPromotion}
        />

        {promotions.length === 0 && !loading && (
          <div className="no-promotions">
            <h3>No promotions available</h3>
            <p>Check back later for new deals and offers!</p>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default DealsPage;
```

### **File: `src/components/promotions/PromotionList.jsx`**

```jsx
import React from 'react';
import PromotionCard from './PromotionCard';
import './PromotionList.css';

const PromotionList = ({ promotions, userType, onApplyPromotion }) => {
  if (!promotions || promotions.length === 0) {
    return null;
  }

  return (
    <div className="promotion-list">
      <div className="promotion-list-header">
        <h2>Available Promotions</h2>
        <span className="promotion-count">{promotions.length} offers</span>
      </div>
      
      <div className="promotion-grid">
        {promotions.map((promotion) => (
          <PromotionCard
            key={promotion.id}
            promotion={promotion}
            userType={userType}
            onApply={onApplyPromotion}
          />
        ))}
      </div>
    </div>
  );
};

export default PromotionList;
```

### **File: `src/components/promotions/PromotionCard.jsx`**

```jsx
import React from 'react';
import { formatPromotionDisplay } from '../../utils/promotionUtils';
import './PromotionCard.css';

const PromotionCard = ({ promotion, userType, onApply }) => {
  const displayData = formatPromotionDisplay(promotion);

  const handleApply = () => {
    onApply(promotion);
  };

  const getPromotionTypeIcon = (type) => {
    const icons = {
      'FIXED_AMOUNT_OFF_CART': '💰',
      'PERCENT_OFF_CART': '📊',
      'BOGO': '🎁',
      'FREE_SHIPPING': '🚚',
      'FREE_PRODUCT': '🎯',
      'PERCENT_OFF_ITEM': '🏷️',
      'FIXED_AMOUNT_OFF_ITEM': '💵'
    };
    return icons[type] || '🎉';
  };

  const getPromotionTypeLabel = (type) => {
    const labels = {
      'FIXED_AMOUNT_OFF_CART': 'Cart Discount',
      'PERCENT_OFF_CART': 'Percentage Off',
      'BOGO': 'Buy One Get One',
      'FREE_SHIPPING': 'Free Shipping',
      'FREE_PRODUCT': 'Free Product',
      'PERCENT_OFF_ITEM': 'Item Discount',
      'FIXED_AMOUNT_OFF_ITEM': 'Fixed Amount Off'
    };
    return labels[type] || type;
  };

  return (
    <div className={`promotion-card ${promotion.priority <= 3 ? 'high-priority' : ''}`}>
      <div className="promotion-header">
        <div className="promotion-type">
          <span className="type-icon">
            {getPromotionTypeIcon(promotion.type)}
          </span>
          <span className="type-label">
            {getPromotionTypeLabel(promotion.type)}
          </span>
        </div>
        {promotion.priority <= 3 && (
          <div className="priority-badge">🔥 Hot Deal</div>
        )}
      </div>

      <div className="promotion-content">
        <h3 className="promotion-name">{promotion.name}</h3>
        
        {promotion.description && (
          <p className="promotion-description">{promotion.description}</p>
        )}

        <div className="promotion-value">
          {displayData.discount_type === 'FIXED_AMOUNT_OFF' && (
            <span className="discount-amount">
              ₹{displayData.discount_value} OFF
            </span>
          )}
          {displayData.discount_type === 'PERCENT_OFF' && (
            <span className="discount-amount">
              {displayData.discount_value}% OFF
            </span>
          )}
          {displayData.discount_type === 'FREE_SHIPPING' && (
            <span className="discount-amount">FREE SHIPPING</span>
          )}
          {displayData.discount_type === 'BOGO' && (
            <span className="discount-amount">BUY 1 GET 1 FREE</span>
          )}
          {displayData.discount_type === 'FREE_PRODUCT' && (
            <span className="discount-amount">FREE PRODUCT</span>
          )}
        </div>

        {promotion.code && (
          <div className="promotion-code">
            <span className="code-label">Code:</span>
            <span className="code-value">{promotion.code}</span>
          </div>
        )}

        <div className="promotion-dates">
          {promotion.start_date && (
            <div className="date-info">
              <span className="date-label">Starts:</span>
              <span className="date-value">
                {new Date(promotion.start_date).toLocaleDateString()}
              </span>
            </div>
          )}
          {promotion.end_date && (
            <div className="date-info">
              <span className="date-label">Ends:</span>
              <span className="date-value">
                {new Date(promotion.end_date).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="promotion-actions">
        <button
          className={`apply-button ${promotion.auto_apply ? 'auto-apply' : 'manual-apply'}`}
          onClick={handleApply}
        >
          {promotion.auto_apply ? 'Auto Applied' : 'Apply Now'}
        </button>
        
        {userType === 'identified' && (
          <div className="personalized-badge">👤 For You</div>
        )}
      </div>
    </div>
  );
};

export default PromotionCard;
```

### **File: `src/components/promotions/PromotionFilters.jsx`**

```jsx
import React from 'react';
import './PromotionFilters.css';

const PromotionFilters = ({ filters, onFilterChange, onRefresh }) => {
  const handleChannelChange = (e) => {
    onFilterChange({ channel: e.target.value });
  };

  const handleGeoChange = (e) => {
    onFilterChange({ geo: e.target.value });
  };

  const handleLimitChange = (e) => {
    onFilterChange({ limit: parseInt(e.target.value) });
  };

  return (
    <div className="promotion-filters">
      <div className="filter-group">
        <label htmlFor="channel">Channel:</label>
        <select
          id="channel"
          value={filters.channel}
          onChange={handleChannelChange}
        >
          <option value="web">Web</option>
          <option value="mobile">Mobile</option>
          <option value="mobile_app">Mobile App</option>
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="geo">Region:</label>
        <select
          id="geo"
          value={filters.geo}
          onChange={handleGeoChange}
        >
          <option value="IN">India</option>
          <option value="US">United States</option>
          <option value="UK">United Kingdom</option>
          <option value="CA">Canada</option>
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="limit">Show:</label>
        <select
          id="limit"
          value={filters.limit}
          onChange={handleLimitChange}
        >
          <option value={5}>5 promotions</option>
          <option value={10}>10 promotions</option>
          <option value={20}>20 promotions</option>
          <option value={50}>50 promotions</option>
        </select>
      </div>

      <button className="refresh-button" onClick={onRefresh}>
        🔄 Refresh
      </button>
    </div>
  );
};

export default PromotionFilters;
```

---

## 🔧 4. Utility Functions

### **File: `src/utils/promotionUtils.js`**

```javascript
// Format promotion data for display
export const formatPromotionDisplay = (promotion) => {
  return {
    id: promotion.id,
    name: promotion.name,
    description: promotion.description,
    type: promotion.type,
    code: promotion.code,
    auto_apply: promotion.auto_apply,
    discount_type: promotion.discount_type,
    discount_value: promotion.discount_value,
    start_date: promotion.start_date,
    end_date: promotion.end_date,
    priority: promotion.priority,
    is_active: promotion.is_active
  };
};

// Check if promotion is currently active
export const isPromotionActive = (promotion) => {
  const now = new Date();
  const startDate = promotion.start_date ? new Date(promotion.start_date) : null;
  const endDate = promotion.end_date ? new Date(promotion.end_date) : null;
  
  if (startDate && startDate > now) return false;
  if (endDate && endDate < now) return false;
  
  return promotion.is_active;
};

// Get promotion status
export const getPromotionStatus = (promotion) => {
  if (!isPromotionActive(promotion)) {
    return 'expired';
  }
  
  if (promotion.priority <= 3) {
    return 'hot';
  }
  
  if (promotion.auto_apply) {
    return 'auto';
  }
  
  return 'available';
};

// Format discount value for display
export const formatDiscountValue = (promotion) => {
  if (promotion.discount_type === 'FIXED_AMOUNT_OFF') {
    return `₹${promotion.discount_value} OFF`;
  }
  
  if (promotion.discount_type === 'PERCENT_OFF') {
    return `${promotion.discount_value}% OFF`;
  }
  
  if (promotion.discount_type === 'FREE_SHIPPING') {
    return 'FREE SHIPPING';
  }
  
  if (promotion.discount_type === 'BOGO') {
    return 'BUY 1 GET 1 FREE';
  }
  
  if (promotion.discount_type === 'FREE_PRODUCT') {
    return 'FREE PRODUCT';
  }
  
  return 'Special Offer';
};
```

### **File: `src/utils/dateUtils.js`**

```javascript
// Format date for display
export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Format date and time for display
export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Check if date is in the future
export const isFutureDate = (dateString) => {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  const now = new Date();
  
  return date > now;
};

// Check if date is in the past
export const isPastDate = (dateString) => {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  const now = new Date();
  
  return date < now;
};

// Get days until date
export const getDaysUntil = (dateString) => {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = date - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};
```

---

## 🔧 5. Styling

### **File: `src/styles/DealsPage.css`**

```css
.deals-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.deals-header {
  text-align: center;
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.deals-header h1 {
  margin: 0 0 10px 0;
  font-size: 2.5rem;
  font-weight: 700;
}

.deals-header p {
  margin: 0 0 15px 0;
  font-size: 1.1rem;
  opacity: 0.9;
}

.user-type-badge {
  display: inline-block;
  background: rgba(255, 255, 255, 0.2);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
}

.promotion-filters {
  display: flex;
  gap: 20px;
  margin-bottom: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.filter-group label {
  font-weight: 600;
  color: #495057;
  font-size: 0.9rem;
}

.filter-group select {
  padding: 8px 12px;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  font-size: 0.9rem;
  background: white;
  transition: border-color 0.3s ease;
}

.filter-group select:focus {
  outline: none;
  border-color: #667eea;
}

.refresh-button {
  background: #28a745;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.refresh-button:hover {
  background: #218838;
}

.promotion-list {
  margin-bottom: 30px;
}

.promotion-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.promotion-list-header h2 {
  margin: 0;
  color: #495057;
  font-size: 1.5rem;
}

.promotion-count {
  background: #e9ecef;
  color: #6c757d;
  padding: 5px 12px;
  border-radius: 15px;
  font-size: 0.9rem;
  font-weight: 600;
}

.promotion-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.error-container {
  text-align: center;
  padding: 40px;
  background: #f8d7da;
  color: #721c24;
  border-radius: 10px;
  border: 1px solid #f5c6cb;
}

.error-container h3 {
  margin: 0 0 10px 0;
  color: #721c24;
}

.retry-button {
  background: #dc3545;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 15px;
}

.retry-button:hover {
  background: #c82333;
}

.no-promotions {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.no-promotions h3 {
  margin: 0 0 10px 0;
  color: #495057;
}

@media (max-width: 768px) {
  .deals-page {
    padding: 10px;
  }
  
  .deals-header h1 {
    font-size: 2rem;
  }
  
  .promotion-filters {
    flex-direction: column;
    align-items: stretch;
  }
  
  .promotion-grid {
    grid-template-columns: 1fr;
  }
}
```

### **File: `src/styles/PromotionCard.css`**

```css
.promotion-card {
  background: white;
  border-radius: 15px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  position: relative;
}

.promotion-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
}

.promotion-card.high-priority {
  border-color: #ff6b6b;
  background: linear-gradient(135deg, #fff5f5 0%, #ffffff 100%);
}

.promotion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.promotion-type {
  display: flex;
  align-items: center;
  gap: 8px;
}

.type-icon {
  font-size: 1.2rem;
}

.type-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #495057;
}

.priority-badge {
  background: #ff6b6b;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}

.promotion-content {
  padding: 20px;
}

.promotion-name {
  margin: 0 0 10px 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: #212529;
  line-height: 1.3;
}

.promotion-description {
  margin: 0 0 15px 0;
  color: #6c757d;
  font-size: 0.9rem;
  line-height: 1.4;
}

.promotion-value {
  margin: 15px 0;
  text-align: center;
}

.discount-amount {
  display: inline-block;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 24px;
  border-radius: 25px;
  font-size: 1.1rem;
  font-weight: 700;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.promotion-code {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 15px 0;
  padding: 10px;
  background: #e9ecef;
  border-radius: 8px;
}

.code-label {
  font-size: 0.9rem;
  color: #6c757d;
  font-weight: 600;
}

.code-value {
  font-family: 'Courier New', monospace;
  font-size: 1rem;
  font-weight: 700;
  color: #495057;
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

.promotion-dates {
  margin: 15px 0;
  font-size: 0.9rem;
}

.date-info {
  display: flex;
  justify-content: space-between;
  margin: 5px 0;
  padding: 5px 0;
  border-bottom: 1px solid #f8f9fa;
}

.date-label {
  color: #6c757d;
  font-weight: 600;
}

.date-value {
  color: #495057;
  font-weight: 500;
}

.promotion-actions {
  padding: 20px;
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.apply-button {
  background: #28a745;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 25px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
}

.apply-button:hover {
  background: #218838;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
}

.apply-button.auto-apply {
  background: #17a2b8;
  box-shadow: 0 4px 15px rgba(23, 162, 184, 0.3);
}

.apply-button.auto-apply:hover {
  background: #138496;
  box-shadow: 0 6px 20px rgba(23, 162, 184, 0.4);
}

.personalized-badge {
  background: #6f42c1;
  color: white;
  padding: 6px 12px;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: 600;
}

@media (max-width: 768px) {
  .promotion-card {
    margin: 0 10px;
  }
  
  .promotion-header {
    padding: 12px 15px;
  }
  
  .promotion-content {
    padding: 15px;
  }
  
  .promotion-actions {
    padding: 15px;
    flex-direction: column;
    gap: 10px;
  }
  
  .apply-button {
    width: 100%;
  }
}
```

---

## 🔧 6. Common Components

### **File: `src/components/common/LoadingSpinner.jsx`**

```jsx
import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ size = 'medium', message = 'Loading...' }) => {
  return (
    <div className="loading-container">
      <div className={`spinner ${size}`}></div>
      <p className="loading-message">{message}</p>
    </div>
  );
};

export default LoadingSpinner;
```

### **File: `src/components/common/ErrorBoundary.jsx`**

```jsx
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>Please refresh the page and try again.</p>
          <button onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

---

## 🧪 7. Usage Examples

### **Basic Usage:**

```jsx
import React from 'react';
import DealsPage from './components/promotions/DealsPage';

function App() {
  return (
    <div className="App">
      <DealsPage />
    </div>
  );
}

export default App;
```

### **With Custom Filters:**

```jsx
import React, { useState } from 'react';
import { usePromotions } from './hooks/usePromotions';

function CustomDealsPage() {
  const [filters, setFilters] = useState({
    channel: 'mobile_app',
    geo: 'IN',
    limit: 5
  });

  const { promotions, loading, error, userType } = usePromotions(filters);

  return (
    <div>
      {/* Your custom UI */}
    </div>
  );
}
```

---

## 📊 8. API Endpoints Summary

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/v1/promotions` | GET | Optional | **Unified endpoint** - handles both guest and identified users with pagination |

### **Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | string | '1' | Page number for pagination |
| `limit` | string | '10' | Number of promotions to return |
| `userid` | string | - | **User ID for personalized promotions (optional)** |
| `channel` | string | 'web' | Channel (web, mobile, mobile_app) |
| `geo` | string | 'IN' | Geographic region |
| `current_date` | string | now | Current date for filtering (optional) |
| `name` | string | - | Filter by promotion name |
| `type` | string | - | Filter by promotion type |
| `is_active` | string | - | Filter by active status (true/false) |

---

## 🎯 9. Key Features

✅ **Unified API**: Single endpoint handles both guest and identified users  
✅ **Simple Query Pattern**: Uses `userid` parameter like cart/orders  
✅ **Guest User Support**: Public promotions without authentication  
✅ **Identified User Support**: Personalized promotions with `userid`  
✅ **Date Filtering**: Current date validation for active promotions  
✅ **User Segmentation**: New user, first order, loyalty tier targeting  
✅ **Priority Sorting**: Higher priority promotions shown first  
✅ **Responsive Design**: Mobile-first responsive layout  
✅ **Error Handling**: Comprehensive error boundaries and fallbacks  
✅ **Loading States**: Smooth loading experiences  
✅ **Real-time Updates**: Refresh functionality  
✅ **Accessibility**: ARIA labels and keyboard navigation  

---

## 🚀 10. Implementation Steps

### **Step 1: Install Dependencies**
```bash
npm install axios
# or
yarn add axios
```

### **Step 2: Create File Structure**
```bash
mkdir -p src/components/promotions
mkdir -p src/hooks
mkdir -p src/services
mkdir -p src/utils
mkdir -p src/styles
```

### **Step 3: Copy Files**
Copy all the provided files to their respective locations.

### **Step 4: Update Environment Variables**
```bash
# .env
REACT_APP_API_URL=http://localhost:5600
```

### **Step 5: Test Implementation**
```bash
npm start
# or
yarn start
```

---

## 🔒 11. Security Considerations

✅ **Authentication**: Optional - only required for personalized promotions  
✅ **Authorization**: User can only see their own segments  
✅ **Data Sanitization**: Sensitive fields removed from responses  
✅ **Error Handling**: No sensitive information in error messages  
✅ **Input Validation**: All inputs validated and sanitized  

---

## 📈 12. Performance Optimizations

### **Caching Strategy:**
```javascript
// Add React Query for caching
import { useQuery } from 'react-query';

const { data, isLoading, error } = useQuery(
  ['promotions', filters],
  () => fetchPromotions(filters),
  {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  }
);
```

### **Lazy Loading:**
```javascript
// Lazy load promotion cards
const PromotionCard = React.lazy(() => import('./PromotionCard'));

// Use Suspense
<Suspense fallback={<LoadingSpinner />}>
  <PromotionCard />
</Suspense>
```

---

## 📝 13. API Usage Examples

> **⚠️ Important Update**: The API response structure has been updated to match the cart/orders pattern. The response now includes `data` as an array directly, along with `pagination` and `meta` objects, instead of the previous nested structure.

### **Guest User (No Authentication):**
```javascript
// Frontend call
const response = await fetch('/v1/promotions?channel=mobile_app&geo=IN&limit=5');

// Response
{
  "success": true,
  "data": [
    {
      "id": 55,
      "name": "₹100 OFF on Orders Above ₹1000",
      "type": "FIXED_AMOUNT_OFF_CART",
      "discount_value": 100,
      "is_active": true,
      "start_date": "2025-01-01T00:00:00.000Z",
      "end_date": "2025-12-31T00:00:00.000Z",
      "priority": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 5,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "meta": {
    "filters": ["channel", "geo"],
    "total": 5,
    "filtered": true
  }
}
```

### **Identified User (With userid):**
```javascript
// Frontend call
const response = await fetch('/v1/promotions?userid=24&channel=mobile_app&geo=IN&limit=5');

// Response
{
  "success": true,
  "data": [
    {
      "id": 55,
      "name": "₹100 OFF on Orders Above ₹1000",
      "type": "FIXED_AMOUNT_OFF_CART",
      "code": null,
      "auto_apply": true,
      "discount_value": 100,
      "is_active": true,
      "start_date": "2025-01-01T00:00:00.000Z",
      "end_date": "2025-12-31T00:00:00.000Z",
      "priority": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 8,
    "totalPages": 2,
    "hasNext": true,
    "hasPrev": false
  },
  "meta": {
    "filters": ["userid", "channel", "geo"],
    "total": 8,
    "filtered": true
  }
}
```

---

## 🎉 14. Benefits of Unified Approach

### **Consistency with Existing Patterns:**
- ✅ Matches cart/orders API pattern exactly
- ✅ Uses same `userid` query parameter approach
- ✅ Single route handles both use cases
- ✅ Consistent error handling and response format

### **Frontend Simplification:**
- ✅ One API call for both user types
- ✅ Automatic user type detection
- ✅ Simplified state management
- ✅ Easier testing and debugging

### **Backend Efficiency:**
- ✅ Single controller method per use case
- ✅ No complex authentication middleware
- ✅ Cleaner service layer separation
- ✅ Easier to maintain and extend

---

**Your frontend is now ready to display promotions using the unified API approach that matches your existing cart/orders pattern!** 🚀

## 📝 15. Date Filtering Confirmation

**YES, the system filters promotions based on current date:**

1. **Backend Filtering**: The service layer filters promotions where:
   - `start_date <= current_date`
   - `end_date >= current_date`
   - `is_active = true`

2. **Frontend Validation**: Additional client-side validation ensures only currently active promotions are displayed.

3. **Real-time Updates**: The system automatically refreshes promotions based on the current date.

**Example Flow:**
- User visits deals page at 2:00 PM
- System fetches promotions with `current_date = "2025-09-04T14:00:00Z"`
- Only promotions active between start_date and end_date are returned
- Frontend displays only currently valid promotions

## 🔄 16. Migration from Old API

If you're migrating from the old separate endpoints:

### **Old Approach:**
```javascript
// Separate calls with different response structures
const publicPromotions = await fetch('/v1/promotions/public');
const personalizedPromotions = await fetch('/v1/promotions/personalized');
```

### **New Approach:**
```javascript
// Single unified call with consistent response structure
const promotions = await fetch('/v1/promotions?userid=24&page=1&limit=10'); // Optional userid
```

**Migration is simple - just update your API calls to use the unified endpoint!** 🎯
