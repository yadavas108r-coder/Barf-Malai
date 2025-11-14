// Barf Malai - Admin Dashboard JavaScript
// Configuration - Update this with your deployed Apps Script URL
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbwRG4W_4Jk1Jj_dyIHqWQgLphUL_KqcZJKZyuI1o_mB4XBRVIiOhqipqADrShUtL94lHg/exec';

class BarfMalaiAdmin {
    constructor() {
        this.isAuthenticated = false;
        this.categories = [];
        this.products = [];
        this.orders = [];
        this.chart = null;
        
        this.initializeAdmin();
    }

    initializeAdmin() {
        this.bindEvents();
        this.checkAuthentication();
    }

    bindEvents() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        
        // Category form
        document.getElementById('addCategoryForm').addEventListener('submit', (e) => this.handleAddCategory(e));
        
        // Product form
        document.getElementById('addProductForm').addEventListener('submit', (e) => this.handleAddProduct(e));
    }

    // Authentication
    async handleLogin(e) {
        e.preventDefault();
        const password = document.getElementById('adminPassword').value;
        const loginBtn = e.target.querySelector('button');
        
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';

        try {
            const response = await this.callAPI('adminLogin', { pw: password });
            
            if (response.authenticated) {
                this.isAuthenticated = true;
                document.getElementById('loginModal').style.display = 'none';
                document.getElementById('adminDashboard').style.display = 'block';
                this.loadDashboardData();
            } else {
                throw new Error('Invalid password');
            }
        } catch (error) {
            this.showToast(error.message, 'error');
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    }

    checkAuthentication() {
        // For simplicity, we'll check on each load
        // In production, you might want to implement proper session handling
        document.getElementById('loginModal').style.display = 'flex';
        document.getElementById('adminDashboard').style.display = 'none';
    }

    logout() {
        this.isAuthenticated = false;
        document.getElementById('loginModal').style.display = 'flex';
        document.getElementById('adminDashboard').style.display = 'none';
        document.getElementById('adminPassword').value = '';
    }

    // API Call Helper
    async callAPI(action, params = {}) {
        const url = new URL(SHEET_URL);
        url.searchParams.set('action', action);
        url.searchParams.set('callback', 'callback');
        
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.set(key, params[key]);
            }
        });

        try {
            const response = await this.jsonp(url.toString());
            if (response.status === 'success') {
                return response;
            } else {
                throw new Error(response.error || 'Unknown error occurred');
            }
        } catch (error) {
            console.error('API Error:', error);
            this.showToast(error.message, 'error');
            throw error;
        }
    }

    jsonp(url) {
        return new Promise((resolve, reject) => {
            const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2);
            
            window[callbackName] = (response) => {
                delete window[callbackName];
                document.head.removeChild(script);
                resolve(response);
            };

            const script = document.createElement('script');
            script.src = url.replace('callback=callback', `callback=${callbackName}`);
            script.onerror = () => {
                delete window[callbackName];
                document.head.removeChild(script);
                reject(new Error('JSONP request failed'));
            };
            
            document.head.appendChild(script);
        });
    }

    // Dashboard Data
    async loadDashboardData() {
        try {
            const [statsResponse, categoriesResponse, productsResponse, ordersResponse] = await Promise.all([
                this.callAPI('getDashboardStats'),
                this.callAPI('getCategories'),
                this.callAPI('getAllProducts'),
                this.callAPI('getOrders')
            ]);

            this.categories = categoriesResponse.categories || [];
            this.products = productsResponse.products || [];
            this.orders = ordersResponse.orders || [];

            this.updateStats(statsResponse.stats);
            this.renderCategories();
            this.renderProducts();
            this.renderOrders();
            this.renderCharts();
            this.populateCategoryDropdown();

        } catch (error) {
            this.showToast('Failed to load dashboard data', 'error');
        }
    }

    updateStats(stats) {
        document.getElementById('totalOrders').textContent = stats.totalOrders || 0;
        document.getElementById('totalSales').textContent = '₹' + (stats.totalSales || 0);
        document.getElementById('todayOrders').textContent = stats.todayOrders || 0;
        document.getElementById('pendingOrders').textContent = stats.pendingOrders || 0;
    }

    // Categories Management
    async handleAddCategory(e) {
        e.preventDefault();
        const name = document.getElementById('categoryName').value.trim();
        const image = document.getElementById('categoryImage').value.trim();

        if (!name) {
            this.showToast('Category name is required', 'error');
            return;
        }

        const submitBtn = e.target.querySelector('button');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding...';

        try {
            await this.callAPI('addCategory', { name, image });
            this.showToast('Category added successfully', 'success');
            e.target.reset();
            await this.loadDashboardData(); // Refresh data
        } catch (error) {
            // Error already shown by callAPI
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Category';
        }
    }

    async deleteCategory(name) {
        if (!confirm(`Delete category "${name}"? This will fail if products use this category.`)) {
            return;
        }

        try {
            await this.callAPI('deleteCategory', { name });
            this.showToast('Category deleted successfully', 'success');
            await this.loadDashboardData();
        } catch (error) {
            if (error.message.includes('force=true')) {
                if (confirm('Category is used by products. Delete anyway?')) {
                    try {
                        await this.callAPI('deleteCategory', { name, force: 'true' });
                        this.showToast('Category deleted successfully', 'success');
                        await this.loadDashboardData();
                    } catch (forceError) {
                        // Error handled by callAPI
                    }
                }
            }
        }
    }

    renderCategories() {
        const container = document.getElementById('categoriesBody');
        container.innerHTML = '';

        this.categories.forEach(category => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${category.name}</td>
                <td>
                    ${category.imageURL ? 
                        `<img src="${category.imageURL}" alt="${category.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'">` : 
                        'No image'
                    }
                </td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="admin.deleteCategory('${category.name}')">
                        Delete
                    </button>
                </td>
            `;
            container.appendChild(row);
        });
    }

    // Products Management
    populateCategoryDropdown() {
        const dropdown = document.getElementById('productCategory');
        dropdown.innerHTML = '<option value="">Select Category</option>';
        
        this.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.name;
            option.textContent = category.name;
            dropdown.appendChild(option);
        });
    }

    async handleAddProduct(e) {
        e.preventDefault();
        const name = document.getElementById('productName').value.trim();
        const price = parseFloat(document.getElementById('productPrice').value);
        const category = document.getElementById('productCategory').value;
        const type = document.getElementById('productType').value;
        const image = document.getElementById('productImage').value.trim();
        const description = document.getElementById('productDescription').value.trim();

        if (!name || !price || !category) {
            this.showToast('Name, price and category are required', 'error');
            return;
        }

        const submitBtn = e.target.querySelector('button');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding...';

        try {
            await this.callAPI('addProduct', {
                name, price, category, type, image, description
            });
            this.showToast('Product added successfully', 'success');
            e.target.reset();
            await this.loadDashboardData();
        } catch (error) {
            // Error already shown by callAPI
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Product';
        }
    }

    async deleteProduct(name) {
        if (!confirm(`Delete product "${name}"?`)) {
            return;
        }

        try {
            await this.callAPI('deleteProduct', { name });
            this.showToast('Product deleted successfully', 'success');
            await this.loadDashboardData();
        } catch (error) {
            // Error handled by callAPI
        }
    }

    renderProducts() {
        const container = document.getElementById('productsBody');
        container.innerHTML = '';

        this.products.forEach(product => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${product.name}</td>
                <td>₹${product.price}</td>
                <td>${product.category}</td>
                <td>
                    <span class="product-badge ${product.type}">
                        ${product.type === 'veg' ? '🥬 Veg' : '🍗 Non-Veg'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="admin.deleteProduct('${product.name}')">
                        Delete
                    </button>
                </td>
            `;
            container.appendChild(row);
        });
    }

    // Orders Management
    renderOrders() {
        const container = document.getElementById('ordersBody');
        container.innerHTML = '';

        this.orders.forEach(order => {
            const row = document.createElement('tr');
            const date = new Date(order.Timestamp).toLocaleString();
            const itemsPreview = order.Items.slice(0, 2).map(item => 
                `${item.name} (${item.quantity})`
            ).join(', ');
            
            row.innerHTML = `
                <td>${date}</td>
                <td>${order.Name}</td>
                <td>${order.Phone}</td>
                <td>${order.Table}</td>
                <td title="${order.Items.map(item => `${item.name} x${item.quantity}`).join('\n')}">
                    ${itemsPreview}${order.Items.length > 2 ? '...' : ''}
                </td>
                <td>₹${order.Total}</td>
                <td>
                    <span class="product-badge ${order.Status === 'completed' ? 'veg' : 'non-veg'}">
                        ${order.Status}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-primary btn-sm" onclick="admin.generateBill('${order.Timestamp}')">
                            Bill
                        </button>
                        ${order.Status === 'pending' ? 
                            `<button class="btn btn-success btn-sm" onclick="admin.updateOrderStatus('${order.Timestamp}', 'completed')">
                                Complete
                            </button>` : ''
                        }
                    </div>
                </td>
            `;
            container.appendChild(row);
        });
    }

    async updateOrderStatus(orderId, status) {
        try {
            await this.callAPI('updateOrderStatus', { orderId, status });
            this.showToast('Order status updated', 'success');
            await this.loadDashboardData();
        } catch (error) {
            // Error handled by callAPI
        }
    }

    async generateBill(orderId) {
        try {
            const response = await this.callAPI('generateBill', { orderId });
            this.showBill(response.bill);
        } catch (error) {
            // Error handled by callAPI
        }
    }

    showBill(bill) {
        const modal = document.getElementById('billModal');
        const content = document.getElementById('billContent');
        
        const itemsHtml = bill.Items.map(item => `
            <tr>
                <td>${item.name}</td>
                <td>₹${item.price}</td>
                <td>${item.quantity}</td>
                <td>₹${item.price * item.quantity}</td>
            </tr>
        `).join('');

        content.innerHTML = `
            <div style="border: 2px solid #333; padding: 2rem; background: white;">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <h1 style="color: #ff6b6b; margin: 0;">Barf Malai</h1>
                    <p style="margin: 0.5rem 0 0 0; color: #666;">Ice Cream Parlor</p>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                    <div>
                        <strong>Order ID:</strong><br>
                        ${new Date(bill.Timestamp).toLocaleString()}
                    </div>
                    <div>
                        <strong>Customer:</strong><br>
                        ${bill.Name}<br>
                        ${bill.Phone}
                    </div>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid #333;">
                            <th style="text-align: left; padding: 0.5rem;">Item</th>
                            <th style="text-align: right; padding: 0.5rem;">Price</th>
                            <th style="text-align: center; padding: 0.5rem;">Qty</th>
                            <th style="text-align: right; padding: 0.5rem;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                    <tfoot>
                        <tr style="border-top: 2px solid #333;">
                            <td colspan="3" style="text-align: right; padding: 0.5rem; font-weight: bold;">Total:</td>
                            <td style="text-align: right; padding: 0.5rem; font-weight: bold;">₹${bill.Total}</td>
                        </tr>
                    </tfoot>
                </table>
                
                ${bill.Review ? `
                    <div style="margin-bottom: 1rem;">
                        <strong>Special Instructions:</strong><br>
                        ${bill.Review}
                    </div>
                ` : ''}
                
                <div style="text-align: center; margin-top: 2rem; color: #666;">
                    Thank you for your order!<br>
                    Visit us again at Barf Malai
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }

    closeBill() {
        document.getElementById('billModal').style.display = 'none';
    }

    printBill() {
        window.print();
    }

    // Charts
    renderCharts() {
        const ctx = document.getElementById('salesChart').getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }

        // Simple sales chart - in a real app, you'd aggregate data by day
        const recentOrders = this.orders.slice(0, 7).reverse();
        const labels = recentOrders.map(order => 
            new Date(order.Timestamp).toLocaleDateString()
        );
        const data = recentOrders.map(order => order.Total);

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Order Value (₹)',
                    data: data,
                    borderColor: '#ff6b6b',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Recent Orders'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Utility
    showToast(message, type = 'success') {
        const toast = document.getElementById('adminToast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize admin when DOM is loaded
let admin;
document.addEventListener('DOMContentLoaded', () => {
    admin = new BarfMalaiAdmin();
});
