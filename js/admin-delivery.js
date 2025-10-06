// js/admin-delivery.js
// إدارة أسعار التوصيل - دوال متقدمة

class DeliveryManager {
    constructor() {
        this.deliveryPrices = {};
        this.modifiedPrices = {};
        this.isLoading = false;
    }

    // تحميل أسعار التوصيل
    async loadDeliveryPrices() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading(true);
        
        try {
            // محاولة جلب البيانات من Firebase أولاً
            if (window.firebaseService) {
                this.deliveryPrices = await window.firebaseService.getDeliveryPrices();
            }
            
            // إذا لم توجد بيانات في Firebase، نستخدم البيانات المحلية
            if (!this.deliveryPrices || Object.keys(this.deliveryPrices).length === 0) {
                console.log('📦 جاري تحميل بيانات التوصيل من الملف المحلي...');
                const response = await fetch('data/delivery.json');
                const deliveryData = await response.json();
                this.deliveryPrices = deliveryData.deliveryPrices || {};
                
                // حفظ البيانات في Firebase للمرة الأولى
                if (window.firebaseService && Object.keys(this.deliveryPrices).length > 0) {
                    await window.firebaseService.updateDeliveryPrices(this.deliveryPrices);
                }
            }
            
            this.displayDeliveryPrices();
            this.updateStats();
            this.showSuccess('تم تحميل بيانات التوصيل بنجاح');
            
        } catch (error) {
            console.error('❌ خطأ في تحميل أسعار التوصيل:', error);
            this.showError('فشل في تحميل بيانات التوصيل');
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    }

    // عرض أسعار التوصيل في الجدول
    displayDeliveryPrices() {
        const tableBody = document.getElementById('deliveryTableBody');
        
        if (!tableBody) {
            console.error('❌ عنصر الجدول غير موجود');
            return;
        }

        if (!this.deliveryPrices || Object.keys(this.deliveryPrices).length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 2rem; color: #666;">
                        <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                        <h3>لا توجد بيانات</h3>
                        <p>قم بإضافة أول ولاية لبدء إدارة أسعار التوصيل</p>
                    </td>
                </tr>
            `;
            return;
        }

        // ترتيب الولايات أبجدياً
        const sortedWilayas = Object.keys(this.deliveryPrices).sort();
        
        tableBody.innerHTML = sortedWilayas.map(wilaya => {
            // تخطي الخيار الافتراضي "إختر الولاية"
            if (wilaya === "إختر الولاية") return '';
            
            const prices = this.deliveryPrices[wilaya];
            const homePrice = prices?.home || 0;
            const deskPrice = prices?.desk || 0;
            
            return `
                <tr data-wilaya="${wilaya}">
                    <td>
                        <strong>${wilaya}</strong>
                    </td>
                    <td>
                        <div class="price-input-container">
                            <input type="number" 
                                   class="price-input" 
                                   value="${homePrice}" 
                                   min="0" 
                                   step="50"
                                   onchange="deliveryManager.markAsModified('${wilaya}', 'home', this.value)"
                                   onfocus="this.select()">
                            <span class="currency">دج</span>
                        </div>
                    </td>
                    <td>
                        <div class="price-input-container">
                            <input type="number" 
                                   class="price-input" 
                                   value="${deskPrice}" 
                                   min="0" 
                                   step="50"
                                   onchange="deliveryManager.markAsModified('${wilaya}', 'desk', this.value)"
                                   onfocus="this.select()">
                            <span class="currency">دج</span>
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-save" onclick="deliveryManager.saveWilayaPrice('${wilaya}')"
                                    title="حفظ التغييرات لهذه الولاية">
                                <i class="fas fa-save"></i>
                            </button>
                            <button class="btn btn-delete" onclick="deliveryManager.deleteWilaya('${wilaya}')"
                                    title="حذف الولاية">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // تحديث حالة زر الحفظ الكلي
        this.updateSaveAllButton();
    }

    // تحديث الإحصائيات
    updateStats() {
        if (!this.deliveryPrices) return;

        const wilayas = Object.keys(this.deliveryPrices).filter(w => w !== "إختر الولاية");
        const totalWilayas = wilayas.length;
        
        let totalHome = 0;
        let totalDesk = 0;
        let countHome = 0;
        let countDesk = 0;
        
        wilayas.forEach(wilaya => {
            const prices = this.deliveryPrices[wilaya];
            if (prices?.home) {
                totalHome += prices.home;
                countHome++;
            }
            if (prices?.desk) {
                totalDesk += prices.desk;
                countDesk++;
            }
        });
        
        const avgHomePrice = countHome ? Math.round(totalHome / countHome) : 0;
        const avgDeskPrice = countDesk ? Math.round(totalDesk / countDesk) : 0;

        // تحديث عناصر الإحصائيات
        this.updateStatElement('totalWilayas', totalWilayas);
        this.updateStatElement('avgHomePrice', avgHomePrice + ' دج');
        this.updateStatElement('avgDeskPrice', avgDeskPrice + ' دج');
        this.updateStatElement('modifiedCount', Object.keys(this.modifiedPrices).length);
    }

    // تحديث عنصر إحصائي
    updateStatElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    // تحديد التغييرات
    markAsModified(wilaya, type, value) {
        if (!this.modifiedPrices[wilaya]) {
            this.modifiedPrices[wilaya] = {};
        }
        
        const numericValue = parseInt(value) || 0;
        this.modifiedPrices[wilaya][type] = numericValue;
        
        // تحديث صف الولاية لتظهر أنه تم تعديله
        const row = document.querySelector(`tr[data-wilaya="${wilaya}"]`);
        if (row) {
            row.classList.add('modified');
        }
        
        this.updateStats();
        this.updateSaveAllButton();
    }

    // تحديث حالة زر الحفظ الكلي
    updateSaveAllButton() {
        const saveAllBtn = document.querySelector('.btn-save-all');
        const modifiedCount = Object.keys(this.modifiedPrices).length;
        
        if (saveAllBtn) {
            if (modifiedCount > 0) {
                saveAllBtn.disabled = false;
                saveAllBtn.innerHTML = `<i class="fas fa-save"></i> حفظ جميع التغييرات (${modifiedCount})`;
                saveAllBtn.classList.add('has-changes');
            } else {
                saveAllBtn.disabled = true;
                saveAllBtn.innerHTML = `<i class="fas fa-save"></i> حفظ جميع التغييرات`;
                saveAllBtn.classList.remove('has-changes');
            }
        }
    }

    // إضافة ولاية جديدة
    async addNewWilaya() {
        const wilayaName = document.getElementById('newWilaya').value.trim();
        const homePrice = parseInt(document.getElementById('newHomePrice').value) || 0;
        const deskPrice = parseInt(document.getElementById('newDeskPrice').value) || 0;
        
        // التحقق من صحة البيانات
        if (!wilayaName) {
            this.showError('⚠️ الرجاء إدخال اسم الولاية');
            return;
        }
        
        if (this.deliveryPrices[wilayaName]) {
            this.showError('⚠️ هذه الولاية موجودة مسبقاً');
            return;
        }
        
        if (homePrice < 0 || deskPrice < 0) {
            this.showError('⚠️ أسعار التوصيل يجب أن تكون أرقام موجبة');
            return;
        }

        this.showLoading(true);
        
        try {
            // إضافة الولاية الجديدة إلى البيانات المحلية
            this.deliveryPrices[wilayaName] = {
                home: homePrice,
                desk: deskPrice
            };
            
            // حفظ في Firebase إذا كان متاحاً
            if (window.firebaseService) {
                await window.firebaseService.updateWilayaPrice(wilayaName, homePrice, deskPrice);
            }
            
            this.showSuccess(`✅ تم إضافة ولاية "${wilayaName}" بنجاح!`);
            
            // إعادة تعيين الحقول
            this.resetAddForm();
            
            // إعادة تحميل البيانات والعرض
            this.displayDeliveryPrices();
            this.updateStats();
            
        } catch (error) {
            console.error('Error adding wilaya:', error);
            this.showError('❌ خطأ في إضافة الولاية: ' + error.message);
            
            // التراجع عن الإضافة في البيانات المحلية
            delete this.deliveryPrices[wilayaName];
        } finally {
            this.showLoading(false);
        }
    }

    // إعادة تعيين فورم الإضافة
    resetAddForm() {
        document.getElementById('newWilaya').value = '';
        document.getElementById('newHomePrice').value = '';
        document.getElementById('newDeskPrice').value = '';
        document.getElementById('newWilaya').focus();
    }

    // حفظ سعر ولاية محددة
    async saveWilayaPrice(wilaya) {
        if (!this.modifiedPrices[wilaya]) {
            this.showInfo('لا توجد تغييرات لحفظها في هذه الولاية');
            return;
        }

        this.showLoading(true);
        
        try {
            const updates = this.modifiedPrices[wilaya];
            const homePrice = updates.home !== undefined ? updates.home : this.deliveryPrices[wilaya]?.home;
            const deskPrice = updates.desk !== undefined ? updates.desk : this.deliveryPrices[wilaya]?.desk;
            
            // تحديث البيانات المحلية
            if (!this.deliveryPrices[wilaya]) {
                this.deliveryPrices[wilaya] = {};
            }
            this.deliveryPrices[wilaya].home = homePrice;
            this.deliveryPrices[wilaya].desk = deskPrice;
            
            // حفظ في Firebase
            if (window.firebaseService) {
                await window.firebaseService.updateWilayaPrice(wilaya, homePrice, deskPrice);
            }
            
            // إزالة الولاية من قائمة المعدلة
            delete this.modifiedPrices[wilaya];
            
            // تحديث الواجهة
            const row = document.querySelector(`tr[data-wilaya="${wilaya}"]`);
            if (row) {
                row.classList.remove('modified');
            }
            
            this.showSuccess(`✅ تم تحديث أسعار ولاية "${wilaya}" بنجاح!`);
            this.updateStats();
            this.updateSaveAllButton();
            
        } catch (error) {
            console.error('Error saving wilaya price:', error);
            this.showError('❌ خطأ في حفظ الأسعار: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    // حفظ جميع التغييرات
    async saveAllPrices() {
        const modifiedCount = Object.keys(this.modifiedPrices).length;
        
        if (modifiedCount === 0) {
            this.showInfo('⚠️ لم تقم بإجراء أي تغييرات');
            return;
        }

        if (!confirm(`هل تريد حفظ ${modifiedCount} تغيير؟`)) {
            return;
        }

        this.showLoading(true);
        
        try {
            const updates = {};
            let successCount = 0;
            
            // تجهيز التحديثات لجميع الولايات المعدلة
            Object.keys(this.modifiedPrices).forEach(wilaya => {
                const wilayaUpdates = this.modifiedPrices[wilaya];
                
                if (!this.deliveryPrices[wilaya]) {
                    this.deliveryPrices[wilaya] = {};
                }
                
                if (wilayaUpdates.home !== undefined) {
                    this.deliveryPrices[wilaya].home = wilayaUpdates.home;
                }
                if (wilayaUpdates.desk !== undefined) {
                    this.deliveryPrices[wilaya].desk = wilayaUpdates.desk;
                }
                
                successCount++;
            });
            
            // حفظ جميع التحديثات في Firebase
            if (window.firebaseService) {
                await window.firebaseService.updateDeliveryPrices(this.deliveryPrices);
            }
            
            // إعادة تعيين قائمة المعدلة
            this.modifiedPrices = {};
            
            // تحديث الواجهة
            document.querySelectorAll('tr.modified').forEach(row => {
                row.classList.remove('modified');
            });
            
            this.showSuccess(`✅ تم حفظ ${successCount} تغيير بنجاح!`);
            this.updateStats();
            this.updateSaveAllButton();
            
        } catch (error) {
            console.error('Error saving all prices:', error);
            this.showError('❌ خطأ في حفظ التغييرات: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    // حذف ولاية
    async deleteWilaya(wilaya) {
        if (!confirm(`هل أنت متأكد من حذف ولاية "${wilaya}"؟\n\nهذا الإجراء لا يمكن التراجع عنه.`)) {
            return;
        }

        this.showLoading(true);
        
        try {
            // حذف من البيانات المحلية
            delete this.deliveryPrices[wilaya];
            delete this.modifiedPrices[wilaya];
            
            // حذف من Firebase
            if (window.firebaseService) {
                await window.firebaseService.deleteWilaya(wilaya);
            }
            
            this.showSuccess(`✅ تم حذف ولاية "${wilaya}" بنجاح!`);
            
            // إعادة تحميل البيانات والعرض
            this.displayDeliveryPrices();
            this.updateStats();
            
        } catch (error) {
            console.error('Error deleting wilaya:', error);
            this.showError('❌ خطأ في حذف الولاية: ' + error.message);
            
            // إعادة تحميل البيانات من المصدر الأصلي في حالة الخطأ
            this.loadDeliveryPrices();
        } finally {
            this.showLoading(false);
        }
    }

    // استيراد بيانات من ملف
    async importFromFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (!importedData.deliveryPrices) {
                    throw new Error('الملف لا يحتوي على بيانات أسعار توصيل صالحة');
                }
                
                if (!confirm(`هل تريد استيراد بيانات ${Object.keys(importedData.deliveryPrices).length} ولاية؟\n\nسيتم استبدال جميع البيانات الحالية.`)) {
                    return;
                }

                this.showLoading(true);
                
                // استبدال البيانات الحالية
                this.deliveryPrices = importedData.deliveryPrices;
                this.modifiedPrices = {};
                
                // حفظ في Firebase
                if (window.firebaseService) {
                    await window.firebaseService.updateDeliveryPrices(this.deliveryPrices);
                }
                
                this.showSuccess('✅ تم استيراد البيانات بنجاح!');
                this.displayDeliveryPrices();
                this.updateStats();
                
            } catch (error) {
                console.error('Error importing data:', error);
                this.showError('❌ خطأ في استيراد البيانات: ' + error.message);
            } finally {
                this.showLoading(false);
                // إعادة تعيين حقل الملف
                event.target.value = '';
            }
        };
        
        reader.readAsText(file);
    }

    // تصدير البيانات إلى ملف
    exportToFile() {
        if (!this.deliveryPrices || Object.keys(this.deliveryPrices).length === 0) {
            this.showError('لا توجد بيانات للتصدير');
            return;
        }

        const dataToExport = {
            deliveryPrices: this.deliveryPrices,
            exportDate: new Date().toISOString(),
            totalWilayas: Object.keys(this.deliveryPrices).length
        };

        const dataStr = JSON.stringify(dataToExport, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `delivery-prices-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        this.showSuccess('✅ تم تصدير البيانات بنجاح!');
    }

    // إعادة تعيين جميع البيانات
    async resetAllData() {
        if (!confirm('⚠️ تحذير: هذا الإجراء سيحذف جميع بيانات التوصيل!\n\nهل أنت متأكد من المتابعة؟')) {
            return;
        }

        this.showLoading(true);
        
        try {
            // إعادة تعيين البيانات المحلية
            this.deliveryPrices = {};
            this.modifiedPrices = {};
            
            // حذف من Firebase
            if (window.firebaseService) {
                await window.firebaseService.updateDeliveryPrices({});
            }
            
            this.showSuccess('✅ تم إعادة تعيين جميع البيانات بنجاح!');
            this.displayDeliveryPrices();
            this.updateStats();
            
        } catch (error) {
            console.error('Error resetting data:', error);
            this.showError('❌ خطأ في إعادة تعيين البيانات: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    // البحث في الولايات
    searchWilayas(searchTerm) {
        const rows = document.querySelectorAll('#deliveryTableBody tr');
        let visibleCount = 0;
        
        rows.forEach(row => {
            const wilayaName = row.getAttribute('data-wilaya');
            if (wilayaName && wilayaName.toLowerCase().includes(searchTerm.toLowerCase())) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });
        
        // عرض رسالة إذا لم توجد نتائج
        const noResultsElement = document.getElementById('noResults');
        if (noResultsElement) {
            noResultsElement.style.display = visibleCount === 0 ? 'block' : 'none';
        }
    }

    // عرض/إخفاء حالة التحميل
    showLoading(show) {
        const loadingElement = document.getElementById('loadingIndicator');
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
        }
        
        // تعطيل الأزرار أثناء التحميل
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            if (show) {
                btn.disabled = true;
            } else {
                btn.disabled = false;
            }
        });
    }

    // عرض رسائل النجاح
    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    // عرض رسائل الخطأ
    showError(message) {
        this.showMessage(message, 'error');
    }

    // عرض رسائل معلومات
    showInfo(message) {
        this.showMessage(message, 'info');
    }

    // عرض رسالة
    showMessage(message, type) {
        // إزالة أي رسائل سابقة
        this.removeExistingMessages();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = `
            <div class="message-content">
                <i class="fas fa-${this.getMessageIcon(type)}"></i>
                <span>${message}</span>
                <button class="message-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(messageDiv);
        
        // إظهار الرسالة مع تأثير
        setTimeout(() => messageDiv.classList.add('show'), 100);
        
        // إخفاء تلقائي بعد 5 ثواني
        setTimeout(() => {
            if (messageDiv.parentElement) {
                messageDiv.classList.remove('show');
                setTimeout(() => messageDiv.remove(), 300);
            }
        }, 5000);
    }

    // الحصول على أيقونة الرسالة
    getMessageIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // إزالة الرسائل الحالية
    removeExistingMessages() {
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());
    }
}

// إنشاء نسخة عامة من مدير التوصيل
window.deliveryManager = new DeliveryManager();

// إضافة الأنماط الديناميكية
const deliveryStyles = `
    .price-input-container {
        position: relative;
        display: inline-block;
    }
    
    .price-input {
        padding-right: 40px !important;
        text-align: left;
    }
    
    .currency {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: #666;
        font-size: 0.9em;
    }
    
    .action-buttons {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
    }
    
    .btn-save {
        background: #28a745;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
    }
    
    .btn-save:hover {
        background: #218838;
    }
    
    .btn-save-all.has-changes {
        background: #ffc107;
        color: #212529;
        animation: pulse 2s infinite;
    }
    
    .btn-save-all:disabled {
        background: #6c757d;
        cursor: not-allowed;
    }
    
    tr.modified {
        background: #fff3cd !important;
        border-left: 4px solid #ffc107;
    }
    
    .message {
        position: fixed;
        top: 20px;
        right: 20px;
        min-width: 300px;
        max-width: 500px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        transform: translateX(400px);
        opacity: 0;
        transition: all 0.3s ease;
    }
    
    .message.show {
        transform: translateX(0);
        opacity: 1;
    }
    
    .message.success {
        border-left: 4px solid #28a745;
    }
    
    .message.error {
        border-left: 4px solid #dc3545;
    }
    
    .message.info {
        border-left: 4px solid #17a2b8;
    }
    
    .message-content {
        padding: 1rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    
    .message.success .message-content i {
        color: #28a745;
    }
    
    .message.error .message-content i {
        color: #dc3545;
    }
    
    .message.info .message-content i {
        color: #17a2b8;
    }
    
    .message-close {
        background: none;
        border: none;
        color: #666;
        cursor: pointer;
        margin-right: auto;
    }
    
    .loading-indicator {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255,255,255,0.8);
        z-index: 9999;
        align-items: center;
        justify-content: center;
        flex-direction: column;
    }
    
    .loading-spinner {
        width: 50px;
        height: 50px;
        border: 5px solid #f3f3f3;
        border-top: 5px solid #4a90e2;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
    
    .search-box {
        margin-bottom: 1rem;
    }
    
    .search-box input {
        width: 100%;
        padding: 0.75rem;
        border: 2px solid #ddd;
        border-radius: 8px;
        font-size: 1rem;
    }
    
    .import-export-buttons {
        display: flex;
        gap: 1rem;
        margin: 1rem 0;
    }
    
    .file-input-wrapper {
        position: relative;
        display: inline-block;
    }
    
    .file-input-wrapper input[type="file"] {
        position: absolute;
        left: 0;
        top: 0;
        opacity: 0;
        width: 100%;
        height: 100%;
        cursor: pointer;
    }
`;

// إضافة الأنماط إلى الصفحة
const styleSheet = document.createElement('style');
styleSheet.textContent = deliveryStyles;
document.head.appendChild(styleSheet);

// تهيئة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    if (window.deliveryManager) {
        // تحميل البيانات
        window.deliveryManager.loadDeliveryPrices();
        
        // إعداد أحداث الأزرار
        const addWilayaBtn = document.querySelector('.btn-add-wilaya');
        if (addWilayaBtn) {
            addWilayaBtn.onclick = () => window.deliveryManager.addNewWilaya();
        }
        
        const saveAllBtn = document.querySelector('.btn-save-all');
        if (saveAllBtn) {
            saveAllBtn.onclick = () => window.deliveryManager.saveAllPrices();
        }
        
        const exportBtn = document.querySelector('.btn-export');
        if (exportBtn) {
            exportBtn.onclick = () => window.deliveryManager.exportToFile();
        }
        
        const resetBtn = document.querySelector('.btn-reset');
        if (resetBtn) {
            resetBtn.onclick = () => window.deliveryManager.resetAllData();
        }
        
        // إعداد حدث البحث
        const searchInput = document.querySelector('.search-box input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                window.deliveryManager.searchWilayas(e.target.value);
            });
        }
        
        // إعداد حدث الاستيراد
        const importInput = document.querySelector('input[type="file"]');
        if (importInput) {
            importInput.addEventListener('change', (e) => {
                window.deliveryManager.importFromFile(e);
            });
        }
        
        // إضافة مؤشر التحميل إذا لم يكن موجوداً
        if (!document.getElementById('loadingIndicator')) {
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'loadingIndicator';
            loadingDiv.className = 'loading-indicator';
            loadingDiv.innerHTML = `
                <div class="loading-spinner"></div>
                <p>جاري معالجة البيانات...</p>
            `;
            document.body.appendChild(loadingDiv);
        }
    }
});

// دوال مساعدة للاستخدام في HTML
window.addNewWilaya = function() {
    window.deliveryManager.addNewWilaya();
};

window.saveAllPrices = function() {
    window.deliveryManager.saveAllPrices();
};

window.exportToFile = function() {
    window.deliveryManager.exportToFile();
};

window.resetAllData = function() {
    window.deliveryManager.resetAllData();
};
