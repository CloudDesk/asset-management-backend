import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindManyWithFilters, dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
export class CartService {
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, 'Starting dynamic cart findMany with filters');
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Use the new dynamic filtering system
            const { data: carts, total } = await dynamicFindManyWithFilters('cart', filters, {
                skip,
                take,
                useAllColumns: true // Get all available columns
            });
            logger.info({
                cartCount: carts.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: carts.length > 0 ? Object.keys(carts[0]) : []
            }, 'Dynamic cart findMany with filters completed');
            return createPaginationResult(carts, total, page, limit);
        }
        catch (error) {
            logger.error({ error, filters, page, limit }, 'Error in dynamic cart findMany operation');
            throw error;
        }
    }
    async findById(id) {
        try {
            logger.debug({ cartId: id }, 'Starting dynamic cart findById operation');
            const cart = await dynamicFindUnique('cart', { id: parseInt(id) });
            if (!cart) {
                throw new Error('Cart item not found');
            }
            logger.debug({
                cartId: id,
                availableFields: Object.keys(cart)
            }, 'Dynamic cart findById completed');
            return cart;
        }
        catch (error) {
            logger.error({ error, cartId: id }, 'Error in cart findById operation');
            throw error;
        }
    }
    async create(data) {
        try {
            logger.debug({ originalData: data }, 'Starting dynamic cart create operation');
            // Add timestamps
            const cartData = {
                ...data,
                createddate: BigInt(Date.now()),
                modifieddate: BigInt(Date.now())
            };
            const cart = await dynamicCreate('cart', cartData);
            if (!cart) {
                throw new Error('Failed to create cart item - no valid fields provided');
            }
            logger.info({
                cartId: cart.id,
                availableFields: Object.keys(cart)
            }, 'Dynamic cart create completed');
            return cart;
        }
        catch (error) {
            logger.error({ error, data }, 'Error in cart create operation');
            throw error;
        }
    }
    async update(id, data) {
        try {
            // Check if cart item exists
            await this.findById(id);
            logger.debug({ originalData: data, cartId: id }, 'Starting dynamic cart update operation');
            // Add modified timestamp
            const cartData = {
                ...data,
                modifieddate: BigInt(Date.now())
            };
            const cart = await dynamicUpdate('cart', { id: parseInt(id) }, cartData);
            if (!cart) {
                throw new Error('Failed to update cart item - no valid fields provided');
            }
            logger.info({
                cartId: id,
                availableFields: Object.keys(cart)
            }, 'Dynamic cart update completed');
            return cart;
        }
        catch (error) {
            logger.error({ error, data, cartId: id }, 'Error in cart update operation');
            throw error;
        }
    }
    async delete(id) {
        try {
            // Check if cart item exists
            await this.findById(id);
            logger.debug({ cartId: id }, 'Starting dynamic cart delete operation');
            const success = await dynamicDelete('cart', { id: parseInt(id) });
            if (!success) {
                throw new Error('Failed to delete cart item');
            }
            logger.info({ cartId: id }, 'Dynamic cart delete completed successfully');
        }
        catch (error) {
            logger.error({ error, cartId: id }, 'Error in cart delete operation');
            throw error;
        }
    }
    async upsert(data) {
        try {
            const { id, ...updateData } = data;
            if (id) {
                // Update existing cart item
                logger.debug({ cartId: id, data: updateData }, 'Upserting existing cart item');
                return this.update(id.toString(), updateData);
            }
            else {
                // Create new cart item
                logger.debug({ data: updateData }, 'Upserting new cart item');
                return this.create(updateData);
            }
        }
        catch (error) {
            logger.error({ error, data }, 'Error in cart upsert operation');
            throw error;
        }
    }
    // Additional cart-specific methods
    async findByUserId(userId, isCart = true) {
        try {
            logger.debug({ userId, isCart }, 'Starting find cart items by user ID');
            const filters = {
                userid: parseInt(userId),
                iscart: isCart
            };
            const { data: carts } = await dynamicFindManyWithFilters('cart', filters, {
                useAllColumns: true
            });
            logger.info({ userId, cartCount: carts.length }, 'Cart items by user ID retrieved');
            return carts;
        }
        catch (error) {
            logger.error({ error, userId }, 'Error finding cart items by user ID');
            throw error;
        }
    }
    async findWishlistByUserId(userId) {
        try {
            logger.debug({ userId }, 'Starting find wishlist items by user ID');
            const filters = {
                userid: parseInt(userId),
                iswishlist: true
            };
            const { data: wishlist } = await dynamicFindManyWithFilters('cart', filters, {
                useAllColumns: true
            });
            logger.info({ userId, wishlistCount: wishlist.length }, 'Wishlist items by user ID retrieved');
            return wishlist;
        }
        catch (error) {
            logger.error({ error, userId }, 'Error finding wishlist items by user ID');
            throw error;
        }
    }
    async clearCartByUserId(userId) {
        try {
            logger.debug({ userId }, 'Starting clear cart for user');
            const filters = {
                userid: parseInt(userId),
                iscart: true
            };
            // Find all cart items for the user
            const { data: cartItems } = await dynamicFindManyWithFilters('cart', filters, {
                useAllColumns: true
            });
            // Delete each cart item
            for (const item of cartItems) {
                await dynamicDelete('cart', { id: item.id });
            }
            logger.info({ userId, deletedCount: cartItems.length }, 'Cart cleared for user');
            return { deletedCount: cartItems.length };
        }
        catch (error) {
            logger.error({ error, userId }, 'Error clearing cart for user');
            throw error;
        }
    }
}
//# sourceMappingURL=cart.service.js.map