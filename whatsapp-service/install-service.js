const { Service } = require('node-windows');
const path = require('path');

const svc = new Service({
    name:        'ShaabWhatsApp',
    description: 'خدمة إشعارات واتساب — قسم السيطرة',
    script:      path.join(__dirname, 'index.js'),
    nodeOptions: [],
    // إعادة التشغيل تلقائياً عند الفشل
    wait: 2,
    grow: 0.5,
    maxRestarts: 10
});

svc.on('install', () => {
    svc.start();
    console.log('✅ تم تثبيت الخدمة وتشغيلها بنجاح');
    console.log('   اسم الخدمة: ShaabWhatsApp');
    console.log('   يمكنك إدارتها من: services.msc');
});

svc.on('alreadyinstalled', () => {
    console.log('⚠️  الخدمة مثبتة مسبقاً');
});

svc.on('error', err => {
    console.error('❌ خطأ:', err);
});

svc.install();
