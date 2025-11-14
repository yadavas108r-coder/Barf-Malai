// Barf Malai - User Frontend JavaScript
// Configuration - Update this with your deployed Apps Script URL
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbyIu_y5diXbxH2-5v8aosjaTjlLvxE_O8iLR-htUKVJwHybAyeaCMqTm1yQdFbY1AsItQ/exec';

class BarfMalaiApp {
    constructor() {
        this.categories = [];
        this.products = [];
        this.cart = [];
        this.currentCategory = 'all';
        this.cacheTTL = 15 * 60 * 1000; // 15 minutes
        
        this.initializeApp();
    }

    initializeApp() {
        this.bindEvents();
        this.loadMenuData();
        this.loadCartFromStorage();
        this.updateCartUI();
    }

    bindEvents() {
        // Cart toggle
        document.getElementById('cartToggle').addEventListener('click', () => this.toggleCart());
        document.getElementById('closeCart').addEventListener('click', () => this.toggleCart());
        document.getElementById('overlay').addEventListener('click', () => this.toggleCart());

        // Checkout form
        document.getElementById('checkoutForm').addEventListener('submit', (e) => this.handleCheckout(e));

        // Manual refresh
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.refreshMenu();
            }
        });
    }

    // API Call Helper - Fixed JSONP implementation
    async callAPI(action, params = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(SHEET_URL);
            url.searchParams.set('action', action);
            
            Object.keys(params).forEach(key => {
                if (params[key] !== undefined && params[key] !== null) {
                    url.searchParams.set(key, encodeURIComponent(params[key]));
                }
            });

            // Create a unique callback name
            const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
            
            // Create script element
            const script = document.createElement('script');
            script.src = url + '&callback=' + callbackName;
            
            // Define the callback function
            window[callbackName] = (response) => {
                // Clean up
                delete window[callbackName];
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                
                if (response.status === 'success') {
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Unknown error occurred'));
                }
            };

            // Error handling
            script.onerror = () => {
                delete window[callbackName];
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                reject(new Error('Network error: Failed to load script. Check your web app URL.'));
            };

            // Add to document
            document.body.appendChild(script);
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (window[callbackName]) {
                    delete window[callbackName];
                    if (script.parentNode) {
                        script.parentNode.removeChild(script);
                    }
                    reject(new Error('Request timeout'));
                }
            }, 30000);
        });
    }

    // Data Management
    async loadMenuData() {
        const cached = this.getCachedData();
        if (cached) {
            this.categories = cached.categories;
            this.products = cached.products;
            this.renderUI();
            document.getElementById('loading').style.display = 'none';
        }

        try {
            const [categoriesResponse, productsResponse] = await Promise.all([
                this.callAPI('getCategories'),
                this.callAPI('getAllProducts')
            ]);

            this.categories = categoriesResponse.categories || [];
            this.products = productsResponse.products || [];
            
            this.cacheData();
            this.renderUI();
            document.getElementById('loading').style.display = 'none';
        } catch (error) {
            console.error('Failed to load menu:', error);
            document.getElementById('loading').innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <h3>Failed to load menu</h3>
                    <p>${error.message}</p>
                    <button onclick="app.refreshMenu()" class="btn btn-primary" style="margin-top: 1rem;">
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    getCachedData() {
        try {
            const cached = localStorage.getItem('barfMalai_menu');
            const timestamp = localStorage.getItem('barfMalai_timestamp');
            
            if (cached && timestamp) {
                const age = Date.now() - parseInt(timestamp);
                if (age < this.cacheTTL) {
                    return JSON.parse(cached);
                }
            }
        } catch (e) {
            console.warn('Cache read failed:', e);
        }
        return null;
    }

    cacheData() {
        try {
            const data = {
                categories: this.categories,
                products: this.products,
                timestamp: Date.now()
            };
            localStorage.setItem('barfMalai_menu', JSON.stringify(data));
            localStorage.setItem('barfMalai_timestamp', Date.now().toString());
        } catch (e) {
            console.warn('Cache write failed:', e);
        }
    }

    async refreshMenu() {
        localStorage.removeItem('barfMalai_menu');
        localStorage.removeItem('barfMalai_timestamp');
        document.getElementById('loading').style.display = 'block';
        document.getElementById('loading').innerHTML = 'Loading menu...';
        await this.loadMenuData();
        this.showToast('Menu refreshed', 'success');
    }

    // UI Rendering
    renderUI() {
        this.renderCategories();
        this.renderProducts();
    }

    renderCategories() {
        const container = document.getElementById('categoriesContainer');
        container.innerHTML = '';
        
        const allCategory = document.createElement('div');
        allCategory.className = `category-card ${this.currentCategory === 'all' ? 'active' : ''}`;
        allCategory.innerHTML = `
            <div class="category-image" style="background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem;">
                🍦
            </div>
            <div class="category-name">All Items</div>
        `;
        allCategory.addEventListener('click', () => this.filterByCategory('all'));
        container.appendChild(allCategory);

        this.categories.forEach(category => {
            const categoryEl = document.createElement('div');
            categoryEl.className = `category-card ${this.currentCategory === category.name ? 'active' : ''}`;
            categoryEl.innerHTML = `
                <img src="${category.imageURL}" alt="${category.name}" 
                     class="category-image" 
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiByeD0iNDAiIGZpbGw9IiNGOUY5RjkiLz4KPHN2ZyB4PSIyMCIgeT0iMjAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2Qzc1N0QiIHN0cm9rZS13aWR0aD0iMiI+CjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTIwLjdIMy4zQTIuMyAyLjMgMCAwIDAgMSA1LjZ2MTIuOGEyLjMgMi4zIDAgMCAwIDIuMyAyLjNoMTcuNGEyLjMgMi4zIDAgMCAwIDIuMy0yLjNWNS42YTIuMyAyLjMgMCAwIDAtMi4zLTIuM3pNOC41IDkuNWExIDEgMCAwIDEgMC0yaDdhMSAxIDAgMCAxIDAgMmgteiIvPgo8L3N2Zz4KPC9zdmc+'">
                <div class="category-name">${category.name}</div>
            `;
            categoryEl.addEventListener('click', () => this.filterByCategory(category.name));
            container.appendChild(categoryEl);
        });
    }

    renderProducts() {
        const container = document.getElementById('productsContainer');
        container.innerHTML = '';

        const filteredProducts = this.currentCategory === 'all' 
            ? this.products 
            : this.products.filter(product => product.category === this.currentCategory);

        if (filteredProducts.length === 0) {
            container.innerHTML = '<div class="loading">No products found in this category.</div>';
            return;
        }

        filteredProducts.forEach(product => {
            const productEl = document.createElement('div');
            productEl.className = 'product-card';
            productEl.innerHTML = `
                <div class="product-badge ${product.type}">
                    ${product.type === 'veg' ? '🥬 Veg' : '🍗 Non-Veg'}
                </div>
                <img src="${product.image}" alt="${product.name}" 
                     class="product-image"
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDI4MCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyODAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjlGOUY5Ii8+CjxzdmcgeD0iMTEwIiB5PSI3MCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzZDNzU3RCIgc3Ryb2tlLXdpZHRoPSIyIj4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJNMjAuN0gzLjNBMi4zIDIuMyAwIDAgMCAxIDUuNnYxMi44YTIuMyAyLjMgMCAwIDAgMi4zIDIuM2gxNy40YTIuMyAyLjMgMCAwIDAgMi4zLTIuM1Y1LjZhMi4zIDIuMyAwIDAgMC0yLjMtMi4zek04LjUgOS41YTEgMSAwIDAgMSAwLTJoN2ExIDEgMCAwIDEgMCAyaC03eiIvPgo8L3N2Zz4KPC9zdmc+'">
                <div class="product-info">
                    <div class="product-header">
                        <h3 class="product-name">${product.name}</h3>
                        <div class="product-price">₹${product.price}</div>
                    </div>
                    <div class="product-category">${product.category}</div>
                    <p class="product-description">${product.description}</p>
                    <button class="add-to-cart" onclick="app.addToCart(${product.id})">
                        Add to Cart
                    </button>
                </div>
            `;
            container.appendChild(productEl);
        });
    }

    filterByCategory(categoryName) {
        this.currentCategory = categoryName;
        document.querySelectorAll('.category-card').forEach(card => card.classList.remove('active'));
        event.currentTarget.classList.add('active');
        this.renderProducts();
    }

    // Cart Management
    addToCart(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        const existingItem = this.cart.find(item => item.id === productId);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.cart.push({
                id: productId,
                name: product.name,
                price: product.price,
                image: product.image,
                quantity: 1
            });
        }

        this.saveCartToStorage();
        this.updateCartUI();
        this.showToast(`Added ${product.name} to cart`, 'success');
    }

    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.id !== productId);
        this.saveCartToStorage();
        this.updateCartUI();
    }

    updateQuantity(productId, change) {
        const item = this.cart.find(item => item.id === productId);
        if (!item) return;

        item.quantity += change;
        
        if (item.quantity <= 0) {
            this.removeFromCart(productId);
        } else {
            this.saveCartToStorage();
            this.updateCartUI();
        }
    }

    updateCartUI() {
        const cartCount = document.getElementById('cartCount');
        const cartTotal = document.getElementById('cartTotal');
        const checkoutTotal = document.getElementById('checkoutTotal');
        const cartItems = document.getElementById('cartItems');
        const checkoutBtn = document.getElementById('checkoutBtn');

        // Update counts and totals
        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        const totalAmount = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        cartCount.textContent = totalItems;
        cartTotal.textContent = totalAmount;
        checkoutTotal.textContent = totalAmount;
        checkoutBtn.disabled = totalItems === 0;

        // Update cart items list
        cartItems.innerHTML = '';
        
        if (this.cart.length === 0) {
            cartItems.innerHTML = '<div class="loading">Your cart is empty</div>';
            return;
        }

        this.cart.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'cart-item';
            itemEl.innerHTML = `
                <img src="${item.image}" alt="${item.name}" class="cart-item-image"
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiByeD0iOCIgZmlsbD0iI0Y5RjlGOSIvPgo8c3ZnIHg9IjE1IiB5PSIxNSIgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzZDNzU3RCIgc3Ryb2tlLXdpZHRoPSIyIj4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJNMjAuN0gzLjNBMi4zIDIuMyAwIDAgMCAxIDUuNnYxMi44YTIuMyAyLjMgMCAwIDAgMi4zIDIuM2gxNy40YTIuMyAyLjMgMCAwIDAgMi4zLTIuM1Y1LjZhMi4zIDIuMyAwIDAgMC0yLjMtMi4zek04LjUgOS41YTEgMSAwIDAgMSAwLTJoN2ExIDEgMCAwIDEgMCAyaC03eiIvPgo8L3N2Zz4KPC9zdmc+'">
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">₹${item.price} × ${item.quantity} = ₹${item.price * item.quantity}</div>
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="app.updateQuantity(${item.id}, -1)">-</button>
                        <span>${item.quantity}</span>
                        <button class="quantity-btn" onclick="app.updateQuantity(${item.id}, 1)">+</button>
                        <button class="remove-item" onclick="app.removeFromCart(${item.id})">Remove</button>
                    </div>
                </div>
            `;
            cartItems.appendChild(itemEl);
        });
    }

    saveCartToStorage() {
        try {
            localStorage.setItem('barfMalai_cart', JSON.stringify(this.cart));
        } catch (e) {
            console.warn('Cart save failed:', e);
        }
    }

    loadCartFromStorage() {
        try {
            const saved = localStorage.getItem('barfMalai_cart');
            if (saved) {
                this.cart = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Cart load failed:', e);
            this.cart = [];
        }
    }

    clearCart() {
        this.cart = [];
        this.saveCartToStorage();
        this.updateCartUI();
    }

    // Cart Drawer
    toggleCart() {
        const drawer = document.getElementById('cartDrawer');
        const overlay = document.getElementById('overlay');
        
        drawer.classList.toggle('open');
        overlay.classList.toggle('show');
        
        document.body.style.overflow = drawer.classList.contains('open') ? 'hidden' : '';
    }

    // Checkout
    async handleCheckout(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const name = formData.get('userName').trim();
        const phone = formData.get('phone').trim();
        const email = formData.get('userEmail').trim();
        const table = formData.get('userTable').trim();
        const review = formData.get('userNote').trim();

        // Validation
        if (name.length < 2) {
            this.showToast('Name must be at least 2 characters', 'error');
            return;
        }

        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length < 7 || phoneDigits.length > 15) {
            this.showToast('Phone must be 7-15 digits', 'error');
            return;
        }

        const checkoutBtn = document.getElementById('checkoutBtn');
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Placing Order...';

        try {
            const orderData = {
                name: name,
                phone: phone,
                email: email || '',
                table: table || '',
                review: review || '',
                cart: this.cart.map(item => ({
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity
                })),
                totalAmount: this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
            };

            const response = await this.callAPI('placeOrder', {
                orderData: JSON.stringify(orderData)
            });

            this.showToast('Order placed successfully!', 'success');
            this.clearCart();
            e.target.reset();
            this.toggleCart();

            // Clear cache to ensure fresh data on next load
            localStorage.removeItem('barfMalai_menu');
            localStorage.removeItem('barfMalai_timestamp');

        } catch (error) {
            this.showToast('Failed to place order: ' + error.message, 'error');
        } finally {
            checkoutBtn.disabled = false;
            checkoutBtn.innerHTML = `Place Order - ₹<span id="checkoutTotal">0</span>`;
        }
    }

    // Utility
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new BarfMalaiApp();
});

// Manual refresh function for debugging
window.refreshMenu = function() {
    if (app) app.refreshMenu();
};
