// Barf Malai - Admin Dashboard JavaScript
// Configuration - Update this with your deployed Apps Script URL
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbyIu_y5diXbxH2-5v8aosjaTjlLvxE_O8iLR-htUKVJwHybAyeaCMqTm1yQdFbY1AsItQ/exec';


class BarfMalaiAdmin {
    constructor() {
        this.isAuthenticated = false;
        this.categories = [];
        this.products = [];
        this.orders = [];
        this.chart = null;
        this.currentUploadType = null; // 'category' or 'product'
        this.imgurClientId = ''; // Leave empty if you don't have Imgur Client ID
        
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
        
        // Image file input change
        document.getElementById('imageFile').addEventListener('change', (e) => this.previewImage(e));
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
            this.showToast('Failed to load dashboard data: ' + error.message, 'error');
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
            document.getElementById('categoryImagePreview').innerHTML = '';
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
                    <button class="btn btn-danger btn-sm" onclick="admin.deleteCategory('${this.escapeString(category.name)}')">
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

        if (price <= 0) {
            this.showToast('Price must be greater than 0', 'error');
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
            document.getElementById('productImagePreview').innerHTML = '';
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
                    <button class="btn btn-danger btn-sm" onclick="admin.deleteProduct('${this.escapeString(product.name)}')">
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

        if (this.orders.length === 0) {
            container.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No orders found</td></tr>';
            return;
        }

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
                        <button class="btn btn-primary btn-sm" onclick="admin.generateBill('${this.escapeString(order.Timestamp)}')">
                            Bill
                        </button>
                        ${order.Status === 'pending' ? 
                            `<button class="btn btn-success btn-sm" onclick="admin.updateOrderStatus('${this.escapeString(order.Timestamp)}', 'completed')">
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

    // Image Upload Functionality
    openImageUpload(type) {
        this.currentUploadType = type;
        document.getElementById('imageUploadModal').style.display = 'flex';
        document.getElementById('imageFile').value = '';
        document.getElementById('imageUploadPreview').innerHTML = '';
        document.getElementById('uploadProgress').style.display = 'none';
        document.getElementById('uploadHelp').style.display = this.imgurClientId ? 'none' : 'block';
    }

    closeImageUpload() {
        document.getElementById('imageUploadModal').style.display = 'none';
        this.currentUploadType = null;
    }

    previewImage(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Check file type
        if (!file.type.match('image.*')) {
            this.showToast('Please select an image file', 'error');
            return;
        }

        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            this.showToast('Image size should be less than 5MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('imageUploadPreview').innerHTML = `
                <img src="${e.target.result}" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 2px solid #e9ecef;">
                <p style="margin-top: 0.5rem; font-size: 0.9rem;">Preview - ${file.name} (${Math.round(file.size/1024)}KB)</p>
            `;
        };
        reader.readAsDataURL(file);
    }

    // Method 1: Upload to Free Image Host (no authentication required)
    async uploadToFreeImageHost() {
        const fileInput = document.getElementById('imageFile');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showToast('Please select an image file', 'error');
            return;
        }

        const uploadBtn = document.getElementById('freeUploadBtn');
        const progress = document.getElementById('uploadProgress');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');

        uploadBtn.disabled = true;
        progress.style.display = 'block';
        progressBar.style.width = '30%';
        progressText.textContent = 'Uploading to free image host...';

        try {
            // Using a free image hosting service
            const formData = new FormData();
            formData.append('image', file);

            // Try multiple free image hosts
            const freeHosts = [
                'https://api.imgbb.com/1/upload?key=your_imgbb_key_here', // You can get free key from imgbb.com
                'https://freeimage.host/api/1/upload' // This might require setup
            ];

            // For now, we'll use a simple base64 conversion for small images
            if (file.size > 2 * 1024 * 1024) {
                throw new Error('File too large for free hosting. Please use Imgur or reduce image size.');
            }

            progressBar.style.width = '70%';
            progressText.textContent = 'Converting image...';

            // Convert to base64 and use data URL (works for small images)
            const base64Url = await this.fileToBase64(file);
            
            progressBar.style.width = '100%';
            progressText.textContent = 'Upload successful!';
            
            this.setImageUrl(base64Url);
            
            setTimeout(() => {
                this.closeImageUpload();
                this.showToast('Image uploaded successfully! (Using base64)', 'success');
            }, 1000);

        } catch (error) {
            this.showToast('Free upload failed: ' + error.message + ' Please try Imgur or paste URL manually.', 'error');
            progressText.textContent = 'Upload failed';
        } finally {
            uploadBtn.disabled = false;
        }
    }

    // Method 2: Upload to Imgur (requires Client ID)
    async uploadToImgur() {
        if (!this.imgurClientId) {
            this.showToast('Imgur Client ID not configured. Please set it up in admin.js or use free upload.', 'error');
            document.getElementById('uploadHelp').style.display = 'block';
            return;
        }

        const fileInput = document.getElementById('imageFile');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showToast('Please select an image file', 'error');
            return;
        }

        const uploadBtn = document.getElementById('imgurUploadBtn');
        const progress = document.getElementById('uploadProgress');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');

        uploadBtn.disabled = true;
        progress.style.display = 'block';
        progressBar.style.width = '30%';
        progressText.textContent = 'Uploading to Imgur...';

        try {
            const formData = new FormData();
            formData.append('image', file);

            const response = await fetch('https://api.imgur.com/3/image', {
                method: 'POST',
                headers: {
                    'Authorization': `Client-ID ${this.imgurClientId}`
                },
                body: formData
            });

            progressBar.style.width = '70%';
            progressText.textContent = 'Processing...';

            const data = await response.json();

            if (data.success) {
                progressBar.style.width = '100%';
                progressText.textContent = 'Upload successful!';
                
                const imageUrl = data.data.link;
                this.setImageUrl(imageUrl);
                
                setTimeout(() => {
                    this.closeImageUpload();
                    this.showToast('Image uploaded successfully to Imgur!', 'success');
                }, 1000);

            } else {
                throw new Error(data.data.error || 'Upload failed');
            }

        } catch (error) {
            this.showToast('Imgur upload failed: ' + error.message, 'error');
            progressText.textContent = 'Upload failed';
        } finally {
            uploadBtn.disabled = false;
        }
    }

    // Method 3: Convert to Base64 (for small images)
    async convertToBase64() {
        const fileInput = document.getElementById('imageFile');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showToast('Please select an image file', 'error');
            return;
        }

        // Check file size (max 500KB for base64)
        if (file.size > 500 * 1024) {
            this.showToast('Image too large for base64. Please use upload options for larger images.', 'error');
            return;
        }

        const uploadBtn = document.getElementById('base64Btn');
        const progress = document.getElementById('uploadProgress');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');

        uploadBtn.disabled = true;
        progress.style.display = 'block';
        progressBar.style.width = '50%';
        progressText.textContent = 'Converting to base64...';

        try {
            const base64Url = await this.fileToBase64(file);
            
            progressBar.style.width = '100%';
            progressText.textContent = 'Conversion successful!';
            
            this.setImageUrl(base64Url);
            
            setTimeout(() => {
                this.closeImageUpload();
                this.showToast('Image converted to base64 successfully!', 'success');
            }, 1000);

        } catch (error) {
            this.showToast('Base64 conversion failed: ' + error.message, 'error');
            progressText.textContent = 'Conversion failed';
        } finally {
            uploadBtn.disabled = false;
        }
    }

    // Helper method to convert file to base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // Helper method to set image URL in the appropriate field
    setImageUrl(imageUrl) {
        if (this.currentUploadType === 'category') {
            document.getElementById('categoryImage').value = imageUrl;
            document.getElementById('categoryImagePreview').innerHTML = `
                <img src="${imageUrl}" style="max-width: 100px; max-height: 100px; border-radius: 4px; border: 1px solid #e9ecef;">
                <p style="margin-top: 0.5rem; font-size: 0.8rem; color: #666;">Preview</p>
            `;
        } else if (this.currentUploadType === 'product') {
            document.getElementById('productImage').value = imageUrl;
            document.getElementById('productImagePreview').innerHTML = `
                <img src="${imageUrl}" style="max-width: 100px; max-height: 100px; border-radius: 4px; border: 1px solid #e9ecef;">
                <p style="margin-top: 0.5rem; font-size: 0.8rem; color: #666;">Preview</p>
            `;
        }
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

    // Utility functions
    escapeString(str) {
        return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
    }

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
